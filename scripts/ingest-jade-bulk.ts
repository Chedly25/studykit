#!/usr/bin/env npx tsx
/* eslint-disable no-console */
/**
 * Ingest the FULL DILA JADE open-data dump — Conseil d'État, Cours
 * administratives d'appel, Tribunaux administratifs, Tribunal des conflits,
 * and CNDA. Stage 5 of the jurisprudence expansion.
 *
 * Prerequisites — download + extract the archive (several GB):
 *   mkdir -p legal-sources-output/cache/jade-bulk
 *   cd legal-sources-output/cache/jade-bulk
 *   # List available archives first:
 *   #   curl -s https://echanges.dila.gouv.fr/OPENDATA/JADE/ | grep Freemium
 *   curl -L -O "https://echanges.dila.gouv.fr/OPENDATA/JADE/Freemium_jade_global_<YYYYMMDD-HHMMSS>.tar.gz"
 *   tar xzf Freemium_jade_global_*.tar.gz
 *   cd ../../..
 *
 * Walks the extracted tree, parses each JADE*.xml, extracts decision text +
 * metadata, chunks on paragraph boundaries. Output is split **per jurisdiction**
 * (CE, CAA, TA, TC, CNDA) so each file is small enough to embed independently,
 * and optionally **flushed into parts** when any jurisdiction's buffer crosses
 * --flush-every chunks so a 10M-chunk full run doesn't balloon node's heap.
 *
 * Output (after a successful run):
 *   legal-sources-output/cache/jade-full-ce.json
 *   legal-sources-output/cache/jade-full-caa.json
 *   legal-sources-output/cache/jade-full-ta.json
 *   legal-sources-output/cache/jade-full-tc.json
 *   legal-sources-output/cache/jade-full-cnda.json
 *   (or -partNNN suffixes when --flush-every triggers mid-run)
 *   legal-sources-output/cache/jade-full.seen  — one XML path per line, for --resume
 *
 * Then, per jurisdiction:
 *   npx tsx scripts/embed-sources.ts --input legal-sources-output/cache/jade-full-ce.json --output-prefix jade-full-ce
 *   for f in legal-sources-output/vectors/jade-full-ce-batch-*.ndjson; do
 *     npx wrangler vectorize insert legal-codes --file="$f"
 *   done
 *
 * Options:
 *   --root            Override bulk extraction root (default auto-detects under
 *                     legal-sources-output/cache/jade-bulk/)
 *   --jurisdictions   CSV of jurisdiction codes to keep (CE, CAA, TA, TC, CNDA). Default: all
 *   --year-min        Keep only decisions with date_dec >= YYYY (default: no cap)
 *   --output-prefix   Output path prefix (default: legal-sources-output/cache/jade-full)
 *   --max-chunk-chars Max chars per chunk (default: 3000)
 *   --flush-every     Flush a jurisdiction's buffer to a -partNNN.json file once it
 *                     hits this many chunks (default: 100000 — set 0 to disable).
 *   --resume          Skip XMLs already recorded in <output-prefix>.seen
 */
import { writeFileSync, readFileSync, readdirSync, statSync, existsSync, createWriteStream } from 'fs'
import { join } from 'path'
import { parseArgs } from 'util'

const { values } = parseArgs({
  options: {
    root:               { type: 'string' },
    jurisdictions:      { type: 'string' },
    'year-min':         { type: 'string' },
    'output-prefix':    { type: 'string', default: 'legal-sources-output/cache/jade-full' },
    'max-chunk-chars':  { type: 'string', default: '3000' },
    'flush-every':      { type: 'string', default: '100000' },
    resume:             { type: 'boolean', default: false },
  },
})

const DEFAULT_ROOT_CANDIDATES = [
  'legal-sources-output/cache/jade-bulk/jade/global',
  'legal-sources-output/cache/jade-bulk',
]
const OUTPUT_PREFIX = values['output-prefix']!
const MAX_CHARS_PER_CHUNK = parseInt(values['max-chunk-chars']!, 10)
const FLUSH_EVERY = parseInt(values['flush-every']!, 10)
const YEAR_MIN = values['year-min'] ? parseInt(values['year-min'], 10) : null
const JURISDICTIONS = values.jurisdictions
  ? new Set(values.jurisdictions.split(',').map(s => s.trim().toUpperCase()))
  : null
const RESUME = values.resume!
const SEEN_LOG = `${OUTPUT_PREFIX}.seen`

interface Chunk {
  id: string
  codeName: string
  num: string
  breadcrumb: string
  text: string
}

function tagContent(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'))
  return m ? m[1] : null
}

function stripTags(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B-\u001F]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function chunkText(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text]
  const paras = text.split(/\n{2,}/g).map(p => p.trim()).filter(Boolean)
  const out: string[] = []
  let buf = ''
  for (const p of paras) {
    if (!buf) { buf = p; continue }
    if (buf.length + p.length + 2 <= maxChars) {
      buf += '\n\n' + p
    } else {
      out.push(buf)
      buf = p
    }
  }
  if (buf) out.push(buf)
  return out.flatMap(c => {
    if (c.length <= maxChars) return [c]
    const pieces: string[] = []
    for (let i = 0; i < c.length; i += maxChars) pieces.push(c.slice(i, i + maxChars))
    return pieces
  })
}

function resolveRoot(): string {
  if (values.root) return values.root
  for (const c of DEFAULT_ROOT_CANDIDATES) {
    if (existsSync(c)) return c
  }
  console.error('Could not find extracted JADE tree. Tried:')
  for (const c of DEFAULT_ROOT_CANDIDATES) console.error(`  - ${c}`)
  console.error('Pass --root <path> or extract the DILA archive under legal-sources-output/cache/jade-bulk/')
  process.exit(1)
}

function* walkXmls(root: string): Generator<string> {
  const stack = [root]
  while (stack.length) {
    const dir = stack.pop()!
    let entries: string[]
    try { entries = readdirSync(dir) } catch { continue }
    for (const e of entries) {
      const full = join(dir, e)
      let s
      try { s = statSync(full) } catch { continue }
      if (s.isDirectory()) stack.push(full)
      else if (s.isFile() && /^CETATEXT.*\.xml$/i.test(e)) yield full
    }
  }
}

function jurisdictionFromXml(xml: string): string {
  const raw = tagContent(xml, 'JURIDICTION') ?? ''
  const clean = stripTags(raw).toUpperCase()
  if (clean.startsWith('CONSEIL D')) return 'CE'
  if (clean.includes('COUR ADMINISTRATIVE')) return 'CAA'
  if (clean.includes('TRIBUNAL ADMINISTRATIF')) return 'TA'
  if (clean.includes('TRIBUNAL DES CONFLITS')) return 'TC'
  if (clean.includes('DROIT D\'ASILE') || clean.includes('CNDA')) return 'CNDA'
  return clean || 'UNKNOWN'
}

function codeNameFor(j: string): string {
  switch (j) {
    case 'CE':   return 'Jurisprudence — Conseil d\'État'
    case 'CAA':  return 'Jurisprudence — Cour administrative d\'appel'
    case 'TA':   return 'Jurisprudence — Tribunal administratif'
    case 'TC':   return 'Jurisprudence — Tribunal des conflits'
    case 'CNDA': return 'Jurisprudence — Cour nationale du droit d\'asile'
    default:     return `Jurisprudence — ${j}`
  }
}

// ─── Per-jurisdiction output buffers + flushing ──────────────────────────

interface JurBuf {
  chunks: Chunk[]
  partIndex: number
  flushedAnyPart: boolean
}

const buffers: Record<string, JurBuf> = {}

function bufferOf(j: string): JurBuf {
  if (!buffers[j]) buffers[j] = { chunks: [], partIndex: 0, flushedAnyPart: false }
  return buffers[j]
}

function flushPart(j: string): void {
  const buf = buffers[j]
  if (!buf || buf.chunks.length === 0) return
  const partPath = `${OUTPUT_PREFIX}-${j.toLowerCase()}-part${String(buf.partIndex).padStart(3, '0')}.json`
  writeFileSync(partPath, JSON.stringify(buf.chunks))
  console.log(`  flushed ${buf.chunks.length} chunks → ${partPath}`)
  buf.chunks = []
  buf.partIndex++
  buf.flushedAnyPart = true
}

function maybeFlush(j: string): void {
  if (FLUSH_EVERY <= 0) return
  const buf = buffers[j]
  if (buf && buf.chunks.length >= FLUSH_EVERY) flushPart(j)
}

function finalFlush(j: string): void {
  const buf = buffers[j]
  if (!buf || buf.chunks.length === 0) return
  if (buf.flushedAnyPart) {
    // Write the trailing partition so part files form a complete set
    flushPart(j)
  } else {
    // Single-file output — no parts were flushed mid-run
    const path = `${OUTPUT_PREFIX}-${j.toLowerCase()}.json`
    writeFileSync(path, JSON.stringify(buf.chunks))
    console.log(`  wrote ${buf.chunks.length} chunks → ${path}`)
    buf.chunks = []
  }
}

// ─── Seen log (resume) ───────────────────────────────────────────────────

function loadSeen(): Set<string> {
  if (!RESUME || !existsSync(SEEN_LOG)) return new Set()
  const lines = readFileSync(SEEN_LOG, 'utf-8').split('\n').filter(Boolean)
  return new Set(lines)
}

// ─── Main ────────────────────────────────────────────────────────────────

const root = resolveRoot()
console.log(`Walking JADE tree at ${root}`)
console.log(`  output prefix: ${OUTPUT_PREFIX}`)
console.log(`  flush every:   ${FLUSH_EVERY > 0 ? `${FLUSH_EVERY} chunks/jurisdiction` : 'disabled'}`)
console.log(`  resume:        ${RESUME}`)
if (JURISDICTIONS) console.log(`  jurisdictions: ${[...JURISDICTIONS].join(',')}`)
if (YEAR_MIN !== null) console.log(`  year min:      ${YEAR_MIN}`)

const seen = loadSeen()
if (seen.size > 0) console.log(`  resuming — ${seen.size} files already processed`)

const seenStream = createWriteStream(SEEN_LOG, { flags: RESUME ? 'a' : 'w' })

let scanned = 0
let skippedSeen = 0
let skippedJurisdiction = 0
let skippedYear = 0
let skippedEmpty = 0
let keptDecisions = 0
const perJurisdiction: Record<string, number> = {}

for (const file of walkXmls(root)) {
  scanned++
  if (seen.has(file)) { skippedSeen++; continue }
  if (scanned % 5000 === 0) {
    const totalChunks = Object.values(buffers).reduce((a, b) => a + b.chunks.length, 0)
    console.log(`  scanned ${scanned}, kept ${keptDecisions}, chunks in memory ${totalChunks}`)
  }

  let xml: string
  try { xml = readFileSync(file, 'utf-8') } catch { seenStream.write(file + '\n'); continue }

  const jurisdiction = jurisdictionFromXml(xml)
  if (JURISDICTIONS && !JURISDICTIONS.has(jurisdiction)) {
    skippedJurisdiction++
    seenStream.write(file + '\n')
    continue
  }

  const dateDec = stripTags(tagContent(xml, 'DATE_DEC') ?? '')
  if (YEAR_MIN !== null) {
    const y = parseInt(dateDec.slice(0, 4), 10)
    if (!isFinite(y) || y < YEAR_MIN) {
      skippedYear++
      seenStream.write(file + '\n')
      continue
    }
  }

  const cetaId = stripTags(tagContent(xml, 'ID') ?? tagContent(xml, 'ID_TEXTE') ?? '')
  const ecli = stripTags(tagContent(xml, 'ECLI') ?? '')
  const idBase = (cetaId || ecli || file.split('/').pop()?.replace(/\.xml$/i, '') || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  const numero = stripTags(tagContent(xml, 'NUMERO') ?? '')
  const formation = stripTags(tagContent(xml, 'FORMATION') ?? '')
  const breadcrumb = [jurisdiction, formation, dateDec, numero].filter(Boolean).join(' • ')

  let body =
    tagContent(xml, 'CONTENU') ??
    tagContent(xml, 'TEXTE_INTEGRAL') ??
    tagContent(xml, 'TEXTE') ??
    ''
  if (body.length < 100) {
    const bloc = tagContent(xml, 'BLOC_TEXTUEL')
    if (bloc) body = bloc
  }
  body = stripTags(body)
  if (body.length < 80) {
    skippedEmpty++
    seenStream.write(file + '\n')
    continue
  }

  const pieces = chunkText(body, MAX_CHARS_PER_CHUNK)
  const buf = bufferOf(jurisdiction)
  pieces.forEach((text, i) => {
    const id = `jade-${jurisdiction.toLowerCase()}-${idBase}${pieces.length > 1 ? `-p${i}` : ''}`.slice(0, 60)
    buf.chunks.push({
      id,
      codeName: codeNameFor(jurisdiction),
      num: numero || dateDec || '',
      breadcrumb,
      text,
    })
  })
  keptDecisions++
  perJurisdiction[jurisdiction] = (perJurisdiction[jurisdiction] ?? 0) + 1
  seenStream.write(file + '\n')
  maybeFlush(jurisdiction)
}

seenStream.end()

console.log('')
console.log(`Scanned:  ${scanned} XMLs`)
console.log(`Kept:     ${keptDecisions} decisions`)
console.log(`Skipped:  ${skippedSeen} already-seen, ${skippedJurisdiction} jurisdiction, ${skippedYear} year, ${skippedEmpty} empty`)
console.log('By jurisdiction:')
for (const [j, n] of Object.entries(perJurisdiction).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${j.padEnd(6)} ${n}`)
}

console.log('\nFlushing remaining buffers...')
for (const j of Object.keys(buffers)) finalFlush(j)

console.log('\nDone. Run embed-sources once per produced file, e.g.:')
for (const j of Object.keys(buffers).map(k => k.toLowerCase())) {
  console.log(`  npx tsx scripts/embed-sources.ts --input ${OUTPUT_PREFIX}-${j}.json --output-prefix ${OUTPUT_PREFIX.split('/').pop()}-${j}`)
}
console.log(`(Append -partNNN.json if --flush-every produced parts; run once per part.)`)
