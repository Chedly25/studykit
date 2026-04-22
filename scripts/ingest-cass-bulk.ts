#!/usr/bin/env npx tsx
/* eslint-disable no-console */
/**
 * Bulk ingest Cour de cassation jurisprudence via Judilibre (PISTE API).
 * Calls Judilibre directly — needs JUDILIBRE_API_KEY env var or --judilibre-key flag.
 *
 * Enumerates all 8 chambers, crawls up to 10,000 published-in-bulletin decisions
 * each, caches per-chamber JSON, then writes a merged chunks JSON for embedding.
 *
 * Judilibre chamber codes (official): soc, civ1, civ2, civ3, comm, cr, mi, pl
 * (Note: comm not com, cr not crim — earlier ingest scripts used wrong codes
 *  and got silent 400s that our worker reflected as 502.)
 *
 * Usage:
 *   JUDILIBRE_API_KEY=<key> npx tsx scripts/ingest-cass-bulk.ts [options]
 *   npx tsx scripts/ingest-cass-bulk.ts --judilibre-key <key> [options]
 *
 * Options:
 *   --judilibre-key      PISTE Judilibre API key (else reads JUDILIBRE_API_KEY env)
 *   --chambers           CSV of chamber codes: soc,civ1,civ2,civ3,comm,cr,mi,pl (default all)
 *   --max-pages          Max pages per query, 50 results/page (default: 200 = 10k cap)
 *   --date-start         Only decisions from this date forward, YYYY-MM-DD (single-query mode)
 *   --partition-by-year  Split each chamber crawl into per-year queries to bypass
 *                        Judilibre's 10k-results pagination cap. Gets full depth for chambers
 *                        with >10k decisions (soc, cr, civ1, comm, civ2, civ3).
 *   --start-year         When partitioning: starting year inclusive (default: 2015)
 *   --end-year           When partitioning: ending year inclusive (default: current year)
 *   --resume             Use existing per-chamber cache (skip re-crawl)
 *
 * Output:
 *   legal-sources-output/cache/cass-bulk/<chamber>.json  — per-chamber chunks
 *   legal-sources-output/cache/cass-bulk.json            — merged for embedding
 *
 * Next:
 *   npx tsx scripts/embed-sources.ts --input legal-sources-output/cache/cass-bulk.json --output-prefix cass-bulk
 */
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { parseArgs } from 'util'

const { values } = parseArgs({
  options: {
    'judilibre-key':      { type: 'string' },
    chambers:             { type: 'string', default: 'soc,civ1,civ2,civ3,comm,cr,mi,pl' },
    'max-pages':          { type: 'string', default: '200' },
    'date-start':         { type: 'string' },
    'partition-by-year':  { type: 'boolean', default: false },
    'start-year':         { type: 'string', default: '2015' },
    'end-year':           { type: 'string' },
    resume:               { type: 'boolean', default: false },
  },
})

const judilibreKey = values['judilibre-key'] ?? process.env.JUDILIBRE_API_KEY
if (!judilibreKey) {
  console.error('Missing Judilibre key. Pass --judilibre-key <key> or set JUDILIBRE_API_KEY env.')
  process.exit(1)
}

const chambersArg = values.chambers!
const maxPages = parseInt(values['max-pages']!, 10)
const dateStart = values['date-start']
const partitionByYear = values['partition-by-year']!
const startYear = parseInt(values['start-year']!, 10)
const endYear = values['end-year'] ? parseInt(values['end-year']!, 10) : new Date().getFullYear()
const resumeMode = values.resume!

const JUDILIBRE_URL = 'https://api.piste.gouv.fr/cassation/judilibre/v1.0/search'
const OUTPUT_DIR = 'legal-sources-output/cache/cass-bulk'
const MERGED_OUT = 'legal-sources-output/cache/cass-bulk.json'
const REQ_DELAY_MS = 300

interface Chunk {
  id: string
  codeName: string
  num: string
  breadcrumb: string
  text: string
}

const ALL_CHAMBERS: Record<string, string> = {
  soc:  'Chambre sociale',
  civ1: 'Première chambre civile',
  civ2: 'Deuxième chambre civile',
  civ3: 'Troisième chambre civile',
  comm: 'Chambre commerciale',
  cr:   'Chambre criminelle',
  mi:   'Chambre mixte',
  pl:   'Assemblée plénière',
}

const selectedChambers = chambersArg
  .split(',')
  .map(c => c.trim())
  .filter(c => c in ALL_CHAMBERS)

if (selectedChambers.length === 0) {
  console.error(`No valid chambers in "${chambersArg}". Valid: ${Object.keys(ALL_CHAMBERS).join(', ')}`)
  process.exit(1)
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

function slugify(t: string): string {
  return t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

async function judilibreSearch(params: Record<string, string | number>): Promise<{
  results?: Array<Record<string, unknown>>
  total?: number
  next_page?: string | null
}> {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) qs.set(k, String(v))
  const res = await fetch(`${JUDILIBRE_URL}?${qs}`, {
    headers: { KeyId: judilibreKey! },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Judilibre ${res.status}: ${text.slice(0, 300)}`)
  }
  return res.json() as Promise<{ results?: Array<Record<string, unknown>>; total?: number; next_page?: string | null }>
}

/** One paginated query through Judilibre. Returns chunks + the reported total. */
async function paginate(
  code: string,
  name: string,
  extraFilter: Record<string, string | number>,
  seenIds: Set<string>,
  out: Chunk[],
  label: string,
): Promise<{ total: number }> {
  let page = 0
  let total = 0

  while (page < maxPages) {
    try {
      const params: Record<string, string | number> = {
        query: '*',
        chamber: code,
        publication: 'b',
        page_size: 50,
        page,
        ...extraFilter,
      }
      const data = await judilibreSearch(params)

      const results = data.results ?? []
      if (results.length === 0) break
      if (page === 0) total = data.total ?? 0

      let newThisPage = 0
      for (const r of results) {
        const id = String(r.id ?? '')
        const number = String(r.number ?? '')
        const date = String(r.decision_date ?? '')
        const solution = String(r.solution ?? '')
        const summary = String(r.summary ?? '')
        const themes = (r.themes as string[]) ?? []

        if (!summary.trim() && !themes.length) continue

        const chunkId = `juris-${code}-${slugify(number || id)}`.slice(0, 60)
        if (seenIds.has(chunkId)) continue
        seenIds.add(chunkId)
        newThisPage++

        const text = [
          `Cass. ${name}, ${date}, n° ${number}`,
          `Solution : ${solution}`,
          summary ? `\n${summary}` : '',
          themes.length ? `\nThèmes : ${themes.join(', ')}` : '',
        ].filter(Boolean).join('\n')

        out.push({
          id: chunkId,
          codeName: `Jurisprudence — ${name}`,
          num: number,
          breadcrumb: `Cour de cassation > ${name} > ${date}`,
          text,
        })
      }

      page++
      if (!data.next_page) break
      if (newThisPage === 0) break
      await sleep(REQ_DELAY_MS)
    } catch (err) {
      console.error(`    [${code}${label}] error at page ${page}: ${(err as Error).message?.slice(0, 200)}`)
      break
    }
  }

  return { total }
}

async function crawlChamber(code: string, name: string): Promise<Chunk[]> {
  const cachePath = join(OUTPUT_DIR, `${code}.json`)
  if (resumeMode && existsSync(cachePath)) {
    const cached = JSON.parse(readFileSync(cachePath, 'utf-8')) as Chunk[]
    console.log(`  [${code}] ${cached.length} decisions (cached, resume mode)`)
    return cached
  }

  const out: Chunk[] = []
  const seenIds = new Set<string>()

  if (partitionByYear) {
    console.log(`  [${code}] crawling ${name} partitioned ${startYear}-${endYear}...`)
    let totalAvail = 0
    for (let year = startYear; year <= endYear; year++) {
      const yearStart = out.length
      const res = await paginate(
        code, name,
        { date_start: `${year}-01-01`, date_end: `${year}-12-31` },
        seenIds, out,
        ` ${year}`,
      )
      totalAvail += res.total
      console.log(`    [${code}] ${year}: +${out.length - yearStart} (avail ${res.total})`)
      await sleep(REQ_DELAY_MS)
    }
    console.log(`  [${code}] ✓ ${out.length} decisions (sum across years ${totalAvail})`)
  } else {
    console.log(`  [${code}] crawling ${name}${dateStart ? ` from ${dateStart}` : ''}...`)
    const extra: Record<string, string | number> = {}
    if (dateStart) extra.date_start = dateStart
    const res = await paginate(code, name, extra, seenIds, out, '')
    console.log(`  [${code}] ✓ ${out.length} decisions (total available: ${res.total})`)
  }

  writeFileSync(cachePath, JSON.stringify(out))
  return out
}

async function main(): Promise<void> {
  mkdirSync(OUTPUT_DIR, { recursive: true })

  console.log('=== ingest-cass-bulk ===')
  console.log(`  chambers:    ${selectedChambers.join(', ')}`)
  console.log(`  max pages:   ${maxPages} (${maxPages * 50} results/query max)`)
  if (partitionByYear) {
    console.log(`  mode:        partitioned by year (${startYear}–${endYear})`)
  } else {
    console.log(`  mode:        single query${dateStart ? ` since ${dateStart}` : ''}`)
  }
  console.log(`  resume:      ${resumeMode}`)
  console.log()

  const allChunks: Chunk[] = []
  const startMs = Date.now()

  for (const code of selectedChambers) {
    const name = ALL_CHAMBERS[code]
    const chunks = await crawlChamber(code, name)
    allChunks.push(...chunks)
    await sleep(500)
  }

  writeFileSync(MERGED_OUT, JSON.stringify(allChunks))
  const elapsed = ((Date.now() - startMs) / 1000).toFixed(0)
  console.log(`\n=== Done ===`)
  console.log(`  Total:   ${allChunks.length} decisions`)
  console.log(`  Output:  ${MERGED_OUT}`)
  console.log(`  Elapsed: ${elapsed}s`)
  console.log(`\nNext:`)
  console.log(`  npx tsx scripts/embed-sources.ts --input ${MERGED_OUT} --output-prefix cass-bulk`)
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
