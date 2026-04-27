"""
Upload the legal cache directory to a Modal Volume via the SDK directly,
bypassing the buggy `modal volume put` CLI.

Usage:
  python3 scripts/modal/upload_cache.py
"""
from __future__ import annotations

import time
from pathlib import Path

import modal

VOLUME_NAME = "studiekit-legal"
LOCAL_CACHE = Path("/Users/chedlyboukhris/Desktop/studykit/legal-sources-output/cache")
REMOTE_PATH = "/cache"


def main() -> None:
    if not LOCAL_CACHE.is_dir():
        raise SystemExit(f"Cache dir not found: {LOCAL_CACHE}")

    files = sorted(LOCAL_CACHE.glob("*.json"))
    total_bytes = sum(f.stat().st_size for f in files)
    print(f"Uploading {len(files)} files ({total_bytes / 1e9:.1f} GB) to "
          f"volume '{VOLUME_NAME}' at {REMOTE_PATH}/")

    vol = modal.Volume.from_name(VOLUME_NAME)

    t0 = time.time()
    with vol.batch_upload(force=True) as batch:
        for i, f in enumerate(files, start=1):
            batch.put_file(str(f), f"{REMOTE_PATH}/{f.name}")
            if i % 10 == 0 or i == len(files):
                elapsed = time.time() - t0
                print(f"  queued {i}/{len(files)} files  ({elapsed:.0f}s elapsed)")

    elapsed = time.time() - t0
    print(f"Upload committed in {elapsed:.0f}s "
          f"({total_bytes / max(elapsed, 1) / 1e6:.1f} MB/s effective)")


if __name__ == "__main__":
    main()
