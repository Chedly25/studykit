#!/usr/bin/env npx tsx
/* eslint-disable no-console */
/**
 * Embed a chunks JSON file with Xenova/multilingual-e5-large (1024-dim) and
 * produce NDJSON ready for `wrangler vectorize insert legal-codes`.
 *
 * Designed for production bulk ingestion — handles malformed input,
 * resumes partial runs, writes per-source output prefixes to avoid collisions.
 *
 * Usage:
 *   npx tsx scripts/embed-sources.ts --input <chunks.json> [options]
 *
 * Options:
 *   --input           Path to chunks JSON (required). Shape: [{ id, codeName, num, breadcrumb, text }]
 *   --output-dir      Base output directory (default: legal-sources-output)
 *   --output-prefix   NDJSON filename prefix (default: derived from input basename)
 *                     e.g. --input cache/cedh.json → cedh-batch-NNN.ndjson
 *   --dtype           q8 (default, 4× faster on CPU) | fp16 | fp32
 *   --batch-size      Embedding batch size (default: 32)
 *   --resume          Skip chunks already present in existing NDJSON by ID
 *   --max-chunk-chars Truncate any input chunk text longer than N (default: 8000)
 *   --skip-oversize   Skip oversized chunks instead of truncating
 *
 * Notes:
 *   - Inputs are sanitized before embedding: PUA chars (U+E000–U+F8FF) stripped,
 *     HTML entities decoded, control chars removed, whitespace collapsed, NFC normalized.
 *   - Chunks with an empty or <8-char sanitized text are skipped.
 *   - Vectorize dedupes by ID on insert (upsert semantics), so re-running is safe.
 */
import { writeFileSync, readFileSync, existsSync, readdirSync, mkdirSync } from 'fs'
import { basename, join } from 'path'
import { parseArgs } from 'util'
import { pipeline } from '@huggingface/transformers'
import { createHash } from 'crypto'

const { values } = parseArgs({
  options: {
    input:              { type: 'string' },
    'output-dir':       { type: 'string', default: 'legal-sources-output' },
    'output-prefix':    { type: 'string' },
    device:             { type: 'string', default: 'auto' },
    dtype:              { type: 'string', default: 'fp16' },
    'batch-size':       { type: 'string', default: '64' },
    resume:             { type: 'boolean', default: false },
    'max-chunk-chars':  { type: 'string', default: '8000' },
    'skip-oversize':    { type: 'boolean', default: false },
  },
})

const inputFile = values.input
if (!inputFile) {
  console.error('Usage: npx tsx scripts/embed-sources.ts --input <chunks.json> [options]')
  console.error('Run with --help for full options list.')
  process.exit(1)
}

const outputDir = values['output-dir']!
const outputPrefix = values['output-prefix'] ?? basename(inputFile, '.json')
const device = values.device!
const dtype = values.dtype as 'q8' | 'fp16' | 'fp32'
const batchSize = Math.max(1, parseInt(values['batch-size']!, 10))
const resumeMode = values.resume!
const maxChunkChars = parseInt(values['max-chunk-chars']!, 10)
const skipOversize = values['skip-oversize']!

if (!['q8', 'fp16', 'fp32'].includes(dtype)) {
  console.error(`Invalid --dtype ${dtype}. Use q8 | fp16 | fp32.`)
  process.exit(1)
}

const vectorsDir = join(outputDir, 'vectors')
mkdirSync(vectorsDir, { recursive: true })

interface Chunk {
  id: string
  codeName: string
  num: string
  breadcrumb: string
  text: string
}

// ─── Sanitizer ──────────────────────────────────────────
//
// Robust cleaner for text pulled from raw HTML (HUDOC, Légifrance, CC, etc.).
// Called once per input chunk before embedding. Fixes the classes of
// malformed content that previously hung the e5-large tokenizer:
//   - Private Use Area Unicode (U+E000–U+F8FF) from PDF conversion artifacts
//   - HTML numeric entities (&#NN; and &#xNN;) not covered by simple decoders
//   - Zero-width chars (U+200B–U+200D, U+FEFF) from copy-pasted sources
//   - ASCII control chars (excluding tab/CR/LF which become whitespace anyway)
//
// Control-char stripping is the point of this regex.
// eslint-disable-next-line no-control-regex
const CONTROL_RX = /[\x00-\x08\x0B\x0C\x0E-\x1F]/g
export function sanitizeForEmbedding(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => {
      try { return String.fromCodePoint(parseInt(h, 16)) } catch { return ' ' }
    })
    .replace(/&#(\d+);/g, (_, n) => {
      try { return String.fromCodePoint(parseInt(n, 10)) } catch { return ' ' }
    })
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/[\uE000-\uF8FF]/g, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(CONTROL_RX, '')
    .replace(/\s+/g, ' ')
    .trim()
    .normalize('NFC')
}

// ─── Resume state ───────────────────────────────────────

function loadExistingIds(): Set<string> {
  if (!resumeMode) return new Set()
  if (!existsSync(vectorsDir)) return new Set()
  const files = readdirSync(vectorsDir).filter(f =>
    f.startsWith(`${outputPrefix}-batch-`) && f.endsWith('.ndjson'),
  )
  const ids = new Set<string>()
  for (const f of files) {
    const content = readFileSync(join(vectorsDir, f), 'utf-8')
    for (const line of content.split('\n')) {
      if (!line.trim()) continue
      try {
        const obj = JSON.parse(line) as { id?: string }
        if (obj.id) ids.add(obj.id)
      } catch { /* skip malformed */ }
    }
  }
  return ids
}

function existingFileCount(): number {
  if (!existsSync(vectorsDir)) return 0
  return readdirSync(vectorsDir).filter(f =>
    f.startsWith(`${outputPrefix}-batch-`) && f.endsWith('.ndjson'),
  ).length
}

// ─── Main ───────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('=== embed-sources ===')
  console.log(`  input:         ${inputFile}`)
  console.log(`  output prefix: ${outputPrefix}`)
  console.log(`  output dir:    ${vectorsDir}`)
  console.log(`  dtype:         ${dtype}`)
  console.log(`  batch size:    ${batchSize}`)
  console.log(`  resume:        ${resumeMode}`)

  const existingIds = loadExistingIds()
  if (existingIds.size > 0) console.log(`  existing IDs:  ${existingIds.size} (will be skipped)`)

  const chunksRaw = JSON.parse(readFileSync(inputFile!, 'utf-8')) as Chunk[]

  // Filter + clean + validate
  const chunks: Array<Chunk & { cleanText: string }> = []
  let skippedResume = 0
  let skippedOversize = 0
  let skippedEmpty = 0

  for (const c of chunksRaw) {
    if (existingIds.has(c.id)) { skippedResume++; continue }

    let text = c.text
    if (text.length > maxChunkChars) {
      if (skipOversize) { skippedOversize++; continue }
      text = text.slice(0, maxChunkChars)
    }

    const clean = sanitizeForEmbedding(text)
    if (clean.length < 8) { skippedEmpty++; continue }

    chunks.push({ ...c, text, cleanText: clean })
  }

  console.log(`  to embed:      ${chunks.length} chunks`)
  console.log(`  skipped:       ${skippedResume} resumed, ${skippedOversize} oversize, ${skippedEmpty} empty`)
  console.log(`  total input:   ${chunksRaw.length}`)

  if (chunks.length === 0) {
    console.log('\nNothing to do.')
    return
  }

  console.log(`\nLoading model (Xenova/multilingual-e5-large, device=${device}, dtype=${dtype})...`)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const embedder = await pipeline('feature-extraction', 'Xenova/multilingual-e5-large', { device, dtype } as any)
  console.log('Model loaded.\n')

  // Stream-write to disk. Accumulating 100k+ lines in memory plus transformers.js
  // per-call allocations reliably OOMs Node's 8GB heap on large inputs — so we
  // flush every 5000 vectors to a new NDJSON file and clear the buffer.
  const LINES_PER_FILE = 5000
  const startIndex = existingFileCount()
  let fileIndex = startIndex
  let written = 0
  let buffer: string[] = []
  let processed = 0
  let batchErrors = 0
  const startMs = Date.now()

  function flushBuffer(): void {
    if (buffer.length === 0) return
    const filename = `${outputPrefix}-batch-${String(fileIndex).padStart(3, '0')}.ndjson`
    writeFileSync(join(vectorsDir, filename), buffer.join('\n') + '\n')
    fileIndex++
    written += buffer.length
    buffer = []
  }

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize)
    // e5-large prompt: "query:" prefix matches how existing 60k vectors were embedded
    const texts = batch.map(c => {
      const raw = `query: ${c.codeName} > ${c.breadcrumb}\n${c.cleanText}`
      return sanitizeForEmbedding(raw).slice(0, 512)
    })

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const outputs = await (embedder as any)(texts, { pooling: 'cls', normalize: true })
      const vectors = outputs.tolist() as number[][]

      for (let j = 0; j < batch.length; j++) {
        const chunk = batch[j]

        // Store the CLEANED text in metadata so downstream RAG consumers
        // (Claude, UI) don't see PUA/control chars. Trim to fit Vectorize's 10KB limit.
        let metaText = chunk.cleanText
        const metaJsonLen = () => new TextEncoder().encode(JSON.stringify({
          num: chunk.num, codeName: chunk.codeName, breadcrumb: chunk.breadcrumb, text: metaText,
        })).length
        while (metaJsonLen() > 10200) {
          metaText = metaText.slice(0, metaText.length - 200) + '...'
          if (metaText.length < 100) break
        }

        // Ensure ID is ≤64 bytes (Vectorize limit)
        let id = chunk.id
        if (new TextEncoder().encode(id).length > 64) {
          const h = createHash('md5').update(id).digest('hex').slice(0, 8)
          id = id.slice(0, 55) + '-' + h
        }

        buffer.push(JSON.stringify({
          id,
          values: vectors[j],
          metadata: {
            num: chunk.num,
            codeName: chunk.codeName,
            breadcrumb: chunk.breadcrumb,
            text: metaText,
          },
        }))
        if (buffer.length >= LINES_PER_FILE) flushBuffer()
      }

      processed += batch.length
      if (processed % 100 < batchSize || processed >= chunks.length) {
        const elapsed = (Date.now() - startMs) / 1000
        const rate = processed / elapsed
        const eta = (chunks.length - processed) / rate
        console.log(`  ${processed}/${chunks.length}  (${rate.toFixed(1)}/s, ETA ${eta.toFixed(0)}s)`)
      }
    } catch (err) {
      batchErrors++
      console.error(`  [batch error @ ${i}] ${(err as Error).message?.slice(0, 300)}`)
    }
  }
  // Flush trailing partial batch
  flushBuffer()

  const totalElapsed = ((Date.now() - startMs) / 1000).toFixed(1)
  console.log(`\n=== Done ===`)
  console.log(`  Embedded:      ${processed} vectors`)
  console.log(`  Batch errors:  ${batchErrors}`)
  console.log(`  Written:       ${written} vectors in ${fileIndex - startIndex} new files`)
  console.log(`  Elapsed:       ${totalElapsed}s`)
  console.log(`\nTo upload to Vectorize:`)
  console.log(`  for f in ${vectorsDir}/${outputPrefix}-batch-*.ndjson; do`)
  console.log(`    wrangler vectorize insert legal-codes --file="$f"`)
  console.log(`  done`)
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
