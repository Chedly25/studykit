#!/usr/bin/env npx tsx
/* eslint-disable no-console */
/**
 * Bulk ingest Cour de cassation FULL TEXT via Judilibre /export.
 *
 * The existing cass-bulk.json holds /search summaries (~13k). This script
 * re-ingests via /export which returns the complete displayText, giving
 * us motifs + dispositif + moyens (needed for commentaire d'arrêt training).
 *
 * Structure mirrors ingest-ca-bulk.ts: year-partitioned, 10k-cap adaptive
 * month partitioning, streaming write per year to avoid V8 heap limits.
 *
 * Usage:
 *   JUDILIBRE_API_KEY=<key> npx tsx scripts/ingest-cass-full.ts [options]
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { parseArgs } from 'util'

const JUDILIBRE_BASE = 'https://api.piste.gouv.fr/cassation/judilibre/v1.0'
const CACHE_DIR = 'legal-sources-output/cache/cass-full-bulk'

const { values } = parseArgs({
  options: {
    'judilibre-key':       { type: 'string' },
    'batch-size':          { type: 'string', default: '1000' },
    'max-batches':         { type: 'string', default: '2000' },
    'start-year':          { type: 'string', default: '1990' },
    'end-year':            { type: 'string' },
    type:                  { type: 'string', default: 'arret' },
    resume:                { type: 'boolean', default: false },
    'rate-limit-ms':       { type: 'string', default: '200' },
    'max-chunk-chars':     { type: 'string', default: '3000' },
  },
})

const API_KEY = values['judilibre-key'] ?? process.env.JUDILIBRE_API_KEY ?? process.env.PISTE_OAUTH_CLIENT_ID
if (!API_KEY) {
  console.error('Missing JUDILIBRE_API_KEY')
  process.exit(1)
}

const BATCH_SIZE = Math.min(1000, Math.max(1, parseInt(values['batch-size']!, 10)))
const MAX_BATCHES = parseInt(values['max-batches']!, 10)
const START_YEAR = parseInt(values['start-year']!, 10)
const END_YEAR = values['end-year'] ? parseInt(values['end-year'], 10) : new Date().getFullYear()
const TYPES = values.type ? values.type.split(',').map(s => s.trim().toLowerCase()).filter(Boolean) : []
const RESUME = values.resume!
const RATE_LIMIT_MS = parseInt(values['rate-limit-ms']!, 10)
const MAX_CHARS_PER_CHUNK = parseInt(values['max-chunk-chars']!, 10)

mkdirSync(CACHE_DIR, { recursive: true })

interface ExportHit {
  id: string
  jurisdiction?: string
  chamber?: string
  decision_date?: string
  ecli?: string
  number?: string[] | string
  numbers?: string[]
  publication?: string[]
  text?: string
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

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

function baseExportQuery(): URLSearchParams {
  const p = new URLSearchParams()
  p.set('jurisdiction', 'cc')
  p.set('batch_size', String(BATCH_SIZE))
  for (const t of TYPES) p.append('type', t)
  return p
}

async function fetchExportBatch(params: URLSearchParams, batch: number): Promise<{
  hits: ExportHit[]; total: number; nextBatch: number | null
}> {
  params.set('batch', String(batch))
  const url = `${JUDILIBRE_BASE}/export?${params.toString()}`
  const res = await fetch(url, { headers: { KeyId: API_KEY!, Accept: 'application/json' } })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Judilibre /export ${res.status} @ batch ${batch}: ${body.slice(0, 300)}`)
  }
  const data = await res.json() as { results?: ExportHit[]; total?: number; next_batch?: string | null }
  return { hits: data.results ?? [], total: data.total ?? 0, nextBatch: data.next_batch ? batch + 1 : null }
}

const HARD_CAP = 10000

function dateRangeParams(base: URLSearchParams, startISO: string, endISO: string): URLSearchParams {
  const p = new URLSearchParams(base)
  p.set('date_start', startISO)
  p.set('date_end', endISO)
  return p
}

async function drainRange(baseParams: URLSearchParams, label: string, startISO: string, endISO: string): Promise<ExportHit[]> {
  const params = dateRangeParams(baseParams, startISO, endISO)
  const probe = await fetchExportBatch(params, 0)
  if (probe.total === 0) return []
  if (probe.total > HARD_CAP) {
    console.log(`  [${label}] total ${probe.total} > ${HARD_CAP}, partitioning by month`)
    const out: ExportHit[] = []
    const start = new Date(startISO)
    const end = new Date(endISO)
    let cursor = new Date(start.getFullYear(), start.getMonth(), 1)
    while (cursor <= end) {
      const m0 = cursor.toISOString().slice(0, 10)
      const nextMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)
      const m1iso = nextMonth > end ? endISO : nextMonth.toISOString().slice(0, 10)
      const mLabel = `${label}-${m0.slice(0, 7)}`
      out.push(...await drainRange(baseParams, mLabel, m0, m1iso))
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
    }
    return out
  }
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
        console.log(`  [${label}] batch ${batch}, ${out.length}/${probe.total} (${rate.toFixed(0)}/s, ETA ${eta.toFixed(0)}s)`)
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
  const chamber = (hit.chamber ?? '').toLowerCase() || 'inconnue'
  const breadcrumb = [
    'Cour de cassation',
    chamber,
    hit.formation ?? '',
    hit.decision_date ?? '',
    num,
    (hit.publication ?? []).join(','),
  ].filter(Boolean).join(' • ')

  const pieces = chunkText(body, MAX_CHARS_PER_CHUNK)
  const idBase = `juris-cass-${chamber}-${(hit.id || num).toLowerCase()}`
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 52)

  return pieces.map((text, i) => ({
    id: `${idBase}${pieces.length > 1 ? `-p${i}` : ''}`.slice(0, 60),
    codeName: 'Jurisprudence — Cour de cassation',
    num: num || hit.decision_date || '',
    breadcrumb,
    text,
  }))
}

const MAX_CHUNKS_PER_FILE = 100_000

function chunkPathsFor(year: number) {
  return {
    single: `legal-sources-output/cache/cass-full-${year}.json`,
    partGlob: `legal-sources-output/cache/cass-full-${year}-part`,
  }
}

function existingYearChunks(year: number): Chunk[] | null {
  const { single, partGlob } = chunkPathsFor(year)
  if (existsSync(single)) return JSON.parse(readFileSync(single, 'utf-8')) as Chunk[]
  const parts: Chunk[] = []
  let i = 0
  while (true) {
    const p = `${partGlob}${String(i).padStart(3, '0')}.json`
    if (!existsSync(p)) break
    parts.push(...(JSON.parse(readFileSync(p, 'utf-8')) as Chunk[]))
    i++
    if (i > 1000) throw new Error(`too many parts for year ${year}`)
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
    const p = `legal-sources-output/cache/cass-full-${year}-part${String(part).padStart(3, '0')}.json`
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

  const hits = await drainRange(baseExportQuery(), `year-${year}`, `${year}-01-01`, `${year}-12-31`)
  const yearChunks: Chunk[] = []
  let dupes = 0
  for (const hit of hits) {
    if (!hit.id) continue
    if (seen.has(hit.id)) { dupes++; continue }
    seen.add(hit.id)
    yearChunks.push(...makeChunks(hit))
  }
  const written = writeYearChunks(year, yearChunks)
  console.log(`  [year-${year}] ${hits.length} hits → ${yearChunks.length} chunks (${dupes} dupes) → ${written.length} file(s)`)
  return { decisions: hits.length - dupes, chunks: yearChunks.length }
}

async function main(): Promise<void> {
  console.log('=== ingest-cass-full (/export mode) ===')
  console.log(`  years:        ${START_YEAR}–${END_YEAR}`)
  console.log(`  types:        ${TYPES.length ? TYPES.join(',') : '(any)'}`)
  console.log(`  batch_size:   ${BATCH_SIZE}`)
  console.log(`  resume:       ${RESUME}`)
  console.log()

  const seen = new Set<string>()
  let totalDecisions = 0
  let totalChunks = 0
  for (let y = START_YEAR; y <= END_YEAR; y++) {
    const { decisions, chunks } = await processYear(y, seen)
    totalDecisions += decisions
    totalChunks += chunks
  }
  console.log(`\nTotal unique decisions: ${totalDecisions}`)
  console.log(`Total chunks written:   ${totalChunks}`)
}

main().catch(err => { console.error(err); process.exit(1) })
