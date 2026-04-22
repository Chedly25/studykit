#!/usr/bin/env npx tsx
/* eslint-disable no-console */
/**
 * Bulk ingest Cours d'appel arrêts via Judilibre (PISTE API), using the
 * /export endpoint to bypass /search's 10k pagination cap and retrieve full
 * text in-line (no N+1 /decision calls).
 *
 * Stage 5 of the jurisprudence expansion.
 *
 * Why /export, not /search:
 *   - /search caps each query at 10k results, and CA volume is ~596k total / ~406k arrêts.
 *   - /export uses batch/batch_size (up to 1000/batch) with no total cap.
 *   - /export returns the displayText field directly — full decision text, no per-id fetch.
 *   - CA has no server-side publication taxonomy (confirmed: publication=b/r/c/l each return 0
 *     total). particularInterest is a /search-only filter and only flags ~400 CA arrêts total,
 *     which is too narrow for a usable CRFPA corpus. So default mode pulls every arrêt.
 *
 * Usage:
 *   JUDILIBRE_API_KEY=<key> npx tsx scripts/ingest-ca-bulk.ts [options]
 *
 * Options:
 *   --judilibre-key      PISTE Judilibre API key (else reads JUDILIBRE_API_KEY env)
 *   --batch-size         /export batch size, max 1000 (default: 1000)
 *   --max-batches        Safety cap on total batches per query (default: 2000 = 2M decisions)
 *   --partition-by-year  Split crawl into per-year queries (default: true for all-arrêts scope)
 *   --start-year         Partition: starting year inclusive (default: 2000)
 *   --end-year           Partition: ending year inclusive (default: current year)
 *   --locations          CSV of CA locations to restrict (e.g. "ca_paris,ca_versailles")
 *   --type               CSV of decision types (default: arret). Valid: arret, ordonnance, other
 *   --resume             Reuse existing cache JSON files (skip re-fetch)
 *   --flush-every        Flush to cache when buffer hits N decisions (default: 5000)
 *   --rate-limit-ms      Delay between batch requests (default: 200)
 *   --max-chunk-chars    Max chars per chunk (default: 3000)
 *
 * Output:
 *   legal-sources-output/cache/ca-bulk/year-<Y>-batch-<N>.json  — raw decision cache
 *   legal-sources-output/cache/ca-bulk.json                     — merged chunks for embedding
 *
 * Then:
 *   npx tsx scripts/embed-sources.ts --input legal-sources-output/cache/ca-bulk.json --output-prefix ca-bulk
 *   for f in legal-sources-output/vectors/ca-bulk-batch-*.ndjson; do
 *     npx wrangler vectorize insert legal-codes --file="$f"
 *   done
 */
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { parseArgs } from 'util'

const JUDILIBRE_BASE = 'https://api.piste.gouv.fr/cassation/judilibre/v1.0'
const CACHE_DIR = 'legal-sources-output/cache/ca-bulk'

const { values } = parseArgs({
  options: {
    'judilibre-key':       { type: 'string' },
    'batch-size':          { type: 'string', default: '1000' },
    'max-batches':         { type: 'string', default: '2000' },
    'partition-by-year':   { type: 'boolean', default: true },
    'start-year':          { type: 'string', default: '2000' },
    'end-year':            { type: 'string' },
    locations:             { type: 'string' },
    type:                  { type: 'string', default: 'arret' },
    resume:                { type: 'boolean', default: false },
    'flush-every':         { type: 'string', default: '5000' },
    'rate-limit-ms':       { type: 'string', default: '200' },
    'max-chunk-chars':     { type: 'string', default: '3000' },
  },
})

const API_KEY = values['judilibre-key'] ?? process.env.JUDILIBRE_API_KEY
if (!API_KEY) {
  console.error('Missing JUDILIBRE_API_KEY — pass --judilibre-key or set env var.')
  process.exit(1)
}

const BATCH_SIZE = Math.min(1000, Math.max(1, parseInt(values['batch-size']!, 10)))
const MAX_BATCHES = parseInt(values['max-batches']!, 10)
const PARTITION = values['partition-by-year']!
const START_YEAR = parseInt(values['start-year']!, 10)
const END_YEAR = values['end-year'] ? parseInt(values['end-year'], 10) : new Date().getFullYear()
const LOCATIONS = values.locations
  ? values.locations.split(',').map(s => s.trim().toLowerCase())
  : null
const TYPES = values.type ? values.type.split(',').map(s => s.trim().toLowerCase()).filter(Boolean) : []
const RESUME = values.resume!
const RATE_LIMIT_MS = parseInt(values['rate-limit-ms']!, 10)
const MAX_CHARS_PER_CHUNK = parseInt(values['max-chunk-chars']!, 10)

mkdirSync(CACHE_DIR, { recursive: true })

interface ExportHit {
  id: string
  jurisdiction?: string
  location?: string
  chamber?: string
  decision_date?: string
  ecli?: string
  number?: string[] | string
  numbers?: string[]
  publication?: string[]
  text?: string
  summary?: string
  formation?: string
  type?: string
}

interface Chunk {
  id: string
  codeName: string
  num: string
  breadcrumb: string
  text: string
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function baseExportQuery(): URLSearchParams {
  const p = new URLSearchParams()
  p.set('jurisdiction', 'ca')
  p.set('batch_size', String(BATCH_SIZE))
  for (const t of TYPES) p.append('type', t)
  if (LOCATIONS) for (const loc of LOCATIONS) p.append('location', loc)
  return p
}

async function fetchExportBatch(params: URLSearchParams, batch: number): Promise<{
  hits: ExportHit[]
  total: number
  nextBatch: number | null
}> {
  params.set('batch', String(batch))
  const url = `${JUDILIBRE_BASE}/export?${params.toString()}`
  const res = await fetch(url, {
    headers: { KeyId: API_KEY!, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Judilibre /export ${res.status} @ batch ${batch}: ${body.slice(0, 300)}`)
  }
  const data = await res.json() as {
    results?: ExportHit[]
    total?: number
    next_batch?: string | null
  }
  return {
    hits: data.results ?? [],
    total: data.total ?? 0,
    nextBatch: data.next_batch ? batch + 1 : null,
  }
}

// Judilibre /export is backed by Elasticsearch with the default 10,000-result cap
// (index.max_result_window). For CA, many recent years have 50-80k arrêts, so we
// partition finer when needed. Strategy: probe a query's total; if it fits, single
// shot; else split into month windows. If a month still exceeds 10k (not yet
// observed but defensive), split into halves.
const HARD_CAP = 10000

function dateRangeParams(base: URLSearchParams, startISO: string, endISO: string): URLSearchParams {
  const p = new URLSearchParams(base)
  p.set('date_start', startISO)
  p.set('date_end', endISO)
  return p
}

async function drainRange(
  baseParams: URLSearchParams,
  label: string,
  startISO: string,
  endISO: string,
): Promise<ExportHit[]> {
  const params = dateRangeParams(baseParams, startISO, endISO)
  const probe = await fetchExportBatch(params, 0)
  if (probe.total === 0) return []

  if (probe.total > HARD_CAP) {
    // Month partition (from range boundaries, not always Jan-Dec)
    console.log(`  [${label}] total ${probe.total} exceeds ${HARD_CAP}, partitioning by month`)
    const out: ExportHit[] = []
    const start = new Date(startISO)
    const end = new Date(endISO)
    let cursor = new Date(start.getFullYear(), start.getMonth(), 1)
    while (cursor <= end) {
      const m0 = cursor.toISOString().slice(0, 10)
      const nextMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)  // last day of month
      const m1iso = nextMonth > end ? endISO : nextMonth.toISOString().slice(0, 10)
      const mLabel = `${label}-${m0.slice(0, 7)}`
      const monthHits = await drainRange(baseParams, mLabel, m0, m1iso)
      out.push(...monthHits)
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
    }
    return out
  }

  // Fits under cap — collect with returned batch 0 already in hand
  const out: ExportHit[] = [...probe.hits]
  let batch = 1
  if (probe.nextBatch === null || probe.hits.length < BATCH_SIZE) {
    console.log(`  [${label}] done — ${out.length} decisions`)
    return out
  }
  const startMs = Date.now()
  while (batch < MAX_BATCHES) {
    try {
      const { hits, nextBatch } = await fetchExportBatch(params, batch)
      out.push(...hits)
      batch++
      if (nextBatch === null || hits.length < BATCH_SIZE) break
      if (batch % 10 === 0) {
        const elapsed = (Date.now() - startMs) / 1000
        const rate = out.length / Math.max(1, elapsed)
        const eta = (probe.total - out.length) / Math.max(1, rate)
        console.log(`  [${label}] batch ${batch}, collected ${out.length}/${probe.total} (${rate.toFixed(0)}/s, ETA ${eta.toFixed(0)}s)`)
      }
      await sleep(RATE_LIMIT_MS)
    } catch (err) {
      console.error(`  [${label}] error @ batch ${batch}: ${(err as Error).message?.slice(0, 300)}`)
      break
    }
  }
  console.log(`  [${label}] done — ${out.length} decisions`)
  return out
}

async function crawlYear(year: number): Promise<ExportHit[]> {
  // Note: we intentionally don't write a per-year hits cache. Big years (2022+)
  // accumulate 2+ GB of hits, and V8's JSON.stringify has a ~512 MB single-string
  // cap that trips on those. Resume is handled at the chunk-file level in
  // processYear, so a year-level hits cache would be redundant.
  const label = `year-${year}`
  const oldHitsCache = join(CACHE_DIR, `${label}.json`)
  if (RESUME && existsSync(oldHitsCache)) {
    const cached = JSON.parse(readFileSync(oldHitsCache, 'utf-8')) as ExportHit[]
    console.log(`  [${label}] legacy hits cached ${cached.length}`)
    return cached
  }
  return await drainRange(baseExportQuery(), label, `${year}-01-01`, `${year}-12-31`)
}

function sanitize(s: string): string {
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B-\u001F]/g, '')
    .replace(/[\uE000-\uF8FF]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function chunkText(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text]
  const out: string[] = []
  for (let i = 0; i < text.length; i += maxChars) out.push(text.slice(i, i + maxChars))
  return out
}

function makeChunks(hit: ExportHit): Chunk[] {
  const body = sanitize(hit.text ?? '')
  if (body.length < 80) return []
  const num = Array.isArray(hit.number) ? hit.number[0] : (hit.number ?? '')
  const loc = (hit.location ?? '').replace(/^ca_/, '')
  const breadcrumb = [
    'Cour d\'appel',
    loc.toUpperCase(),
    hit.formation ?? '',
    hit.decision_date ?? '',
    num,
  ].filter(Boolean).join(' • ')

  const pieces = chunkText(body, MAX_CHARS_PER_CHUNK)
  const idBase = `juris-ca-${loc}-${(hit.id || num).toLowerCase()}`
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 52)

  return pieces.map((text, i) => ({
    id: `${idBase}${pieces.length > 1 ? `-p${i}` : ''}`.slice(0, 60),
    codeName: 'Jurisprudence — Cour d\'appel',
    num: num || hit.decision_date || '',
    breadcrumb,
    text,
  }))
}

// Streaming output — 400k × 40KB hits won't fit in RAM. Each year materialises
// one OR more chunk files (capped at MAX_CHUNKS_PER_FILE so no single JSON
// serialise exceeds V8's ~512MB single-string cap). embed-sources then processes
// each file independently.
const MAX_CHUNKS_PER_FILE = 100_000

function chunkPathsFor(year: number): { single: string; partGlob: string } {
  return {
    single: `legal-sources-output/cache/ca-bulk-${year}.json`,
    partGlob: `legal-sources-output/cache/ca-bulk-${year}-part`,
  }
}

function existingYearChunks(year: number): Chunk[] | null {
  const { single, partGlob } = chunkPathsFor(year)
  if (existsSync(single)) {
    return JSON.parse(readFileSync(single, 'utf-8')) as Chunk[]
  }
  const dir = 'legal-sources-output/cache'
  const parts: Chunk[] = []
  let i = 0
  while (true) {
    const p = `${partGlob}${String(i).padStart(3, '0')}.json`
    if (!existsSync(p)) break
    parts.push(...(JSON.parse(readFileSync(p, 'utf-8')) as Chunk[]))
    i++
    // guard against pathological case
    if (i > 1000) throw new Error(`too many parts for year ${year} under ${dir}`)
  }
  return parts.length ? parts : null
}

function writeYearChunks(year: number, yearChunks: Chunk[]): string[] {
  const { single } = chunkPathsFor(year)
  if (yearChunks.length <= MAX_CHUNKS_PER_FILE) {
    writeFileSync(single, JSON.stringify(yearChunks))
    return [single]
  }
  const paths: string[] = []
  for (let i = 0, part = 0; i < yearChunks.length; i += MAX_CHUNKS_PER_FILE, part++) {
    const slice = yearChunks.slice(i, i + MAX_CHUNKS_PER_FILE)
    const p = `legal-sources-output/cache/ca-bulk-${year}-part${String(part).padStart(3, '0')}.json`
    writeFileSync(p, JSON.stringify(slice))
    paths.push(p)
  }
  return paths
}

async function processYear(year: number, seen: Set<string>): Promise<{ decisions: number; chunks: number }> {
  const cached = existingYearChunks(year)
  if (RESUME && cached) {
    for (const c of cached) seen.add(c.id)
    console.log(`  [year-${year}] chunks cached: ${cached.length}`)
    return { decisions: 0, chunks: cached.length }
  }

  const hits = await crawlYear(year)
  const yearChunks: Chunk[] = []
  let dupes = 0
  for (const hit of hits) {
    if (!hit.id) continue
    if (seen.has(hit.id)) { dupes++; continue }
    seen.add(hit.id)
    yearChunks.push(...makeChunks(hit))
  }
  const written = writeYearChunks(year, yearChunks)
  console.log(`  [year-${year}] ${hits.length} hits → ${yearChunks.length} chunks (${dupes} dupes) → ${written.length} file(s): ${written.map(p => p.split('/').pop()).join(', ')}`)
  return { decisions: hits.length - dupes, chunks: yearChunks.length }
}

async function main(): Promise<void> {
  console.log('=== ingest-ca-bulk (/export mode) ===')
  console.log(`  mode:         ${PARTITION ? `partitioned by year (${START_YEAR}–${END_YEAR})` : 'single query'}`)
  console.log(`  types:        ${TYPES.length ? TYPES.join(',') : '(any)'}`)
  console.log(`  locations:    ${LOCATIONS ? LOCATIONS.join(',') : '(any)'}`)
  console.log(`  batch_size:   ${BATCH_SIZE}`)
  console.log(`  resume:       ${RESUME}`)
  console.log()

  const seen = new Set<string>()
  let totalDecisions = 0
  let totalChunks = 0

  if (PARTITION) {
    for (let y = START_YEAR; y <= END_YEAR; y++) {
      const { decisions, chunks } = await processYear(y, seen)
      totalDecisions += decisions
      totalChunks += chunks
    }
  } else {
    // Non-partitioned: pull full range. Same streaming approach, one file.
    const params = baseExportQuery()
    params.set('date_start', `${START_YEAR}-01-01`)
    params.set('date_end', `${END_YEAR}-12-31`)
    const hitsCache = join(CACHE_DIR, 'all.json')
    const chunkPath = 'legal-sources-output/cache/ca-bulk-all.json'
    if (RESUME && existsSync(chunkPath)) {
      const arr = JSON.parse(readFileSync(chunkPath, 'utf-8')) as Chunk[]
      totalChunks = arr.length
    } else {
      const hits: ExportHit[] = []
      if (RESUME && existsSync(hitsCache)) {
        hits.push(...(JSON.parse(readFileSync(hitsCache, 'utf-8')) as ExportHit[]))
      } else {
        let batch = 0
        while (batch < MAX_BATCHES) {
          const { hits: batchHits, nextBatch } = await fetchExportBatch(params, batch)
          hits.push(...batchHits)
          batch++
          if (nextBatch === null || batchHits.length < BATCH_SIZE) break
          await sleep(RATE_LIMIT_MS)
        }
        writeFileSync(hitsCache, JSON.stringify(hits))
      }
      const yearChunks: Chunk[] = []
      for (const hit of hits) {
        if (!hit.id || seen.has(hit.id)) continue
        seen.add(hit.id)
        yearChunks.push(...makeChunks(hit))
      }
      writeFileSync(chunkPath, JSON.stringify(yearChunks))
      totalDecisions = seen.size
      totalChunks = yearChunks.length
    }
  }

  console.log(`\nTotal unique decisions: ${totalDecisions}`)
  console.log(`Total chunks written:   ${totalChunks}`)
  console.log(`\nNext: run embed-sources on each produced file, e.g.`)
  if (PARTITION) {
    console.log(`  for f in legal-sources-output/cache/ca-bulk-*.json; do`)
    console.log(`    npx tsx scripts/embed-sources.ts --input "$f" --output-prefix "$(basename "$f" .json)"`)
    console.log(`  done`)
  } else {
    console.log(`  npx tsx scripts/embed-sources.ts --input legal-sources-output/cache/ca-bulk-all.json --output-prefix ca-bulk-all`)
  }
}

main().catch(err => { console.error(err); process.exit(1) })
