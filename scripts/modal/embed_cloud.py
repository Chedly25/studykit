"""
Embed the full legal corpus with multilingual-e5-large on Modal GPUs.

Mirrors scripts/embed-sources.ts byte-for-byte on the format side:
- "query: {codeName} > {breadcrumb}\n{cleanText}" prefix
- 512-char truncation (characters, not tokens — matching the TS .slice(0, 512))
- CLS pooling, L2 normalize, same sanitizer
- NDJSON output: {id, values, metadata:{num,codeName,breadcrumb,text}}, 5000/file
- 64-byte ID cap (md5 truncate), 10200-byte metadata JSON cap

Floats will differ from transformers.js ONNX by ~1e-4 per dim (different backend);
cosine similarity stays essentially unchanged so retrieval is the same.

Usage (from repo root):
  pip install modal
  modal setup
  modal volume create studiekit-legal
  modal volume put studiekit-legal ./legal-sources-output/cache /cache
  modal run scripts/modal/embed_cloud.py
  modal volume get studiekit-legal /vectors ./legal-sources-output/vectors-modal

Then upsert to Vectorize:
  for f in ./legal-sources-output/vectors-modal/*.ndjson; do
    wrangler vectorize insert legal-codes --file="$f"
  done
"""
from __future__ import annotations

import modal

APP_NAME = "studiekit-embed"
VOLUME_NAME = "studiekit-legal"
MODEL_ID = "intfloat/multilingual-e5-large"

MAX_CONTAINERS = 10           # Modal Starter allows ~10 concurrent. Dial per your plan.
GPU_CHOICE = "A100-40GB"
BATCH = 128                   # inference batch; 128 fits A100-40GB at fp16 easily
LINES_PER_FILE = 5000         # match TS script
MAX_CHUNK_CHARS = 8000        # match TS --max-chunk-chars default
TRUNCATE_AFTER_PREFIX = 512   # match TS .slice(0, 512) — CHARACTERS not tokens


def _download_model():
    from sentence_transformers import SentenceTransformer
    SentenceTransformer(MODEL_ID)


image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "torch==2.4.0",
        "transformers==4.44.2",
        "sentence-transformers==3.0.1",
        "numpy==1.26.4",
    )
    .run_function(_download_model)  # bake weights into image (~560MB one-time)
)

app = modal.App(APP_NAME, image=image)
vol = modal.Volume.from_name(VOLUME_NAME, create_if_missing=True)


# ─── Sanitizer (1:1 port of scripts/embed-sources.ts sanitizeForEmbedding) ───

import re
import unicodedata

_CONTROL_RX = re.compile(r"[\x00-\x08\x0B\x0C\x0E-\x1F]")
_PUA_RX = re.compile(r"[-]")
_ZW_RX = re.compile(r"[​-‍﻿]")
_HEX_ENT = re.compile(r"&#x([0-9a-fA-F]+);")
_NUM_ENT = re.compile(r"&#(\d+);")
_WS = re.compile(r"\s+")


def sanitize(text: str) -> str:
    def _hex(m):
        try:
            return chr(int(m.group(1), 16))
        except Exception:
            return " "

    def _num(m):
        try:
            return chr(int(m.group(1)))
        except Exception:
            return " "

    text = _HEX_ENT.sub(_hex, text)
    text = _NUM_ENT.sub(_num, text)
    text = (
        text.replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", '"')
        .replace("&apos;", "'")
    )
    text = _PUA_RX.sub("", text)
    text = _ZW_RX.sub("", text)
    text = _CONTROL_RX.sub("", text)
    text = _WS.sub(" ", text).strip()
    return unicodedata.normalize("NFC", text)


@app.function(
    gpu=GPU_CHOICE,
    volumes={"/data": vol},
    timeout=60 * 60,
    memory=16 * 1024,
    max_containers=MAX_CONTAINERS,
)
def embed_file(cache_name: str) -> dict:
    import hashlib
    import json
    import time
    from pathlib import Path

    from sentence_transformers import SentenceTransformer

    cache_path = Path("/data/cache") / cache_name
    if not cache_path.exists():
        return {"file": cache_name, "status": "missing"}

    prefix = cache_path.stem  # e.g. "ca-bulk-2024-part002"
    vectors_dir = Path("/data/vectors")
    vectors_dir.mkdir(parents=True, exist_ok=True)

    # Clean-slate semantics: clear any prior outputs for this prefix
    for stale in vectors_dir.glob(f"{prefix}-batch-*.ndjson"):
        stale.unlink()

    chunks_raw = json.loads(cache_path.read_text())

    # Schema check: skip files without the expected fields (e.g. *-raw scrape artifacts).
    if chunks_raw and not all(k in chunks_raw[0] for k in ("id", "codeName", "breadcrumb", "text")):
        return {
            "file": cache_name,
            "status": "skipped-bad-schema",
            "input": len(chunks_raw),
            "missing_keys": [k for k in ("id", "codeName", "breadcrumb", "text")
                             if k not in chunks_raw[0]],
        }

    prepared: list[dict] = []
    skipped_empty = 0
    for c in chunks_raw:
        text = c.get("text", "")
        if len(text) > MAX_CHUNK_CHARS:
            text = text[:MAX_CHUNK_CHARS]
        clean = sanitize(text)
        if len(clean) < 8:
            skipped_empty += 1
            continue
        prepared.append({**c, "cleanText": clean})

    if not prepared:
        return {
            "file": cache_name,
            "status": "empty",
            "input": len(chunks_raw),
            "skipped_empty": skipped_empty,
        }

    print(f"[{prefix}] loading model")
    model = SentenceTransformer(MODEL_ID, device="cuda")
    model = model.half()  # fp16

    file_index = 0
    buffer: list[str] = []
    processed = 0
    batch_errors = 0
    t0 = time.time()

    def flush():
        nonlocal file_index, buffer
        if not buffer:
            return
        fname = f"{prefix}-batch-{file_index:03d}.ndjson"
        (vectors_dir / fname).write_text("\n".join(buffer) + "\n")
        file_index += 1
        buffer = []

    print(f"[{prefix}] embedding {len(prepared)} chunks")
    for i in range(0, len(prepared), BATCH):
        batch = prepared[i:i + BATCH]
        texts = []
        for c in batch:
            raw = f"query: {c['codeName']} > {c['breadcrumb']}\n{c['cleanText']}"
            texts.append(sanitize(raw)[:TRUNCATE_AFTER_PREFIX])

        try:
            vectors = model.encode(
                texts,
                batch_size=BATCH,
                convert_to_numpy=True,
                normalize_embeddings=True,
                show_progress_bar=False,
            )
        except Exception as e:
            batch_errors += 1
            print(f"[{prefix}] batch error @ {i}: {str(e)[:300]}")
            continue

        for c, v in zip(batch, vectors):
            meta_text = c["cleanText"]
            while True:
                meta_json_bytes = len(
                    json.dumps(
                        {
                            "num": c.get("num", ""),
                            "codeName": c.get("codeName", ""),
                            "breadcrumb": c.get("breadcrumb", ""),
                            "text": meta_text,
                        },
                        ensure_ascii=False,
                    ).encode("utf-8")
                )
                if meta_json_bytes <= 10200:
                    break
                if len(meta_text) < 100:
                    break
                meta_text = meta_text[:-200] + "..."

            cid = c["id"]
            if len(cid.encode("utf-8")) > 64:
                h = hashlib.md5(cid.encode()).hexdigest()[:8]
                cid = cid[:55] + "-" + h

            buffer.append(
                json.dumps(
                    {
                        "id": cid,
                        "values": v.tolist(),
                        "metadata": {
                            "num": c.get("num", ""),
                            "codeName": c.get("codeName", ""),
                            "breadcrumb": c.get("breadcrumb", ""),
                            "text": meta_text,
                        },
                    },
                    ensure_ascii=False,
                )
            )
            if len(buffer) >= LINES_PER_FILE:
                flush()

        processed += len(batch)
        if (i // BATCH) % 50 == 0:
            elapsed = time.time() - t0
            rate = processed / max(elapsed, 0.1)
            eta = (len(prepared) - processed) / max(rate, 0.1)
            print(f"[{prefix}] {processed}/{len(prepared)} ({rate:.0f}/s, ETA {eta:.0f}s)")

    flush()
    # Marker file: written only after all batches successfully flushed.
    # Resume mode treats files without this marker as incomplete.
    (vectors_dir / f"{prefix}.done").write_text("ok")
    vol.commit()

    return {
        "file": cache_name,
        "status": "ok",
        "input": len(chunks_raw),
        "processed": processed,
        "skipped_empty": skipped_empty,
        "batch_errors": batch_errors,
        "elapsed_sec": round(time.time() - t0, 1),
        "rate_chunks_per_sec": round(processed / max(time.time() - t0, 0.1), 1),
        "output_files": file_index,
    }


@app.local_entrypoint()
def main(files: str = "", resume: bool = False):
    """
    files: optional comma-separated list of cache filenames to process.
           If empty, discovers every *.json in /data/cache.
    resume: if True, skip files whose prefix already has at least one
            -batch-NNN.ndjson written (i.e. already complete or in-progress).
            For partial files, manually list them via --files instead.

    Uses Function.spawn() so the local CLI exits immediately after queueing
    work; cloud functions run independently and don't depend on the local
    process staying alive.
    """
    if files:
        targets = [f.strip() for f in files.split(",") if f.strip()]
    else:
        targets = sorted(list_cache.remote())

    if resume:
        done = set(list_done_prefixes.remote())
        before = len(targets)
        targets = [t for t in targets if t.removesuffix(".json") not in done]
        print(f"Resume: {before - len(targets)} files already have vectors, skipping.")

    print(f"Spawning {len(targets)} files on up to {MAX_CONTAINERS}× {GPU_CHOICE}")
    spawned = []
    for target in targets:
        call = embed_file.spawn(target)
        spawned.append((target, call.object_id))

    print(f"\nQueued {len(spawned)} jobs. Local CLI exiting; jobs run on Modal cloud.")
    print("Track progress with:")
    print(f"  modal volume ls studiekit-legal /vectors | grep -c '\\.ndjson'")
    print(f"  modal app logs ap-<...>")
    if spawned:
        print(f"\nFirst 3 call IDs: {[c[1] for c in spawned[:3]]}")


@app.function(volumes={"/data": vol})
def list_cache() -> list[str]:
    from pathlib import Path

    return sorted(p.name for p in Path("/data/cache").glob("*.json"))


@app.function(volumes={"/data": vol})
def list_done_prefixes() -> list[str]:
    """Return prefixes with a .done marker (i.e. fully flushed). Partials don't count."""
    from pathlib import Path

    vectors_dir = Path("/data/vectors")
    if not vectors_dir.exists():
        return []
    return sorted(p.stem for p in vectors_dir.glob("*.done"))


@app.function(volumes={"/data": vol})
def backfill_done_markers(prefixes: list[str]) -> dict:
    """One-time helper: write .done markers for prefixes the caller asserts are complete."""
    from pathlib import Path

    vectors_dir = Path("/data/vectors")
    written = []
    for p in prefixes:
        marker = vectors_dir / f"{p}.done"
        if not marker.exists():
            marker.write_text("ok-backfilled")
            written.append(p)
    vol.commit()
    return {"written": written, "count": len(written)}


@app.function(volumes={"/data": vol})
def clear_partial_prefixes(prefixes: list[str]) -> dict:
    """Delete all batch files for given prefixes so they get re-embedded cleanly."""
    from pathlib import Path

    vectors_dir = Path("/data/vectors")
    deleted = 0
    for p in prefixes:
        for f in vectors_dir.glob(f"{p}-batch-*.ndjson"):
            f.unlink()
            deleted += 1
        marker = vectors_dir / f"{p}.done"
        if marker.exists():
            marker.unlink()
    vol.commit()
    return {"deleted_files": deleted}
