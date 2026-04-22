#!/usr/bin/env npx tsx
/* eslint-disable no-console */
/**
 * Bulk ingest CEDH (ECHR) full-text judgments via the HUDOC search API.
 *
 * Strategy:
 *   1. Paginate HUDOC's ranked search (no auth needed)
 *   2. Client-side filter to CHAMBER/GRANDCHAMBER judgments where
 *      languageisocode=FRE OR respondent=FRA, importance 1-3
 *   3. Deduplicate by itemid, cap at --max-cases
 *   4. Fetch each case's full text via /app/conversion/docx/html/body
 *   5. Aggressively clean HUDOC's HTML artifacts (PUA chars, entities, etc.)
 *   6. Chunk on EN FAIT / EN DROIT / PAR CES MOTIFS boundaries
 *   7. Write merged chunks JSON for embed-sources.ts
 *
 * Usage:
 *   npx tsx scripts/ingest-cedh-bulk.ts [options]
 *
 * Options:
 *   --max-cases     Hard cap on unique cases to fetch (default: 1500)
 *   --max-pages     Max enumeration pages of 500 each (default: 60 = 30k records)
 *   --importance    Comma-separated: 1,2,3,4 (default: 1,2,3 — skip routine)
 *   --branches      Comma-separated doctypebranch filter (default: CHAMBER,GRANDCHAMBER)
 *   --resume        Reuse cached search results + per-case text
 *
 * Output:
 *   legal-sources-output/cache/cedh-bulk/search-page-NNN.json  — paginated search results
 *   legal-sources-output/cache/cedh-bulk/<itemid>.txt           — per-case cleaned text
 *   legal-sources-output/cache/cedh-bulk.json                   — merged chunks
 *
 * Next:
 *   npx tsx scripts/embed-sources.ts --input legal-sources-output/cache/cedh-bulk.json --output-prefix cedh-bulk
 */
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { parseArgs } from 'util'

const { values } = parseArgs({
  options: {
    'max-cases':  { type: 'string', default: '1500' },
    'max-pages':  { type: 'string', default: '60' },
    importance:   { type: 'string', default: '1,2,3' },
    branches:     { type: 'string', default: 'CHAMBER,GRANDCHAMBER' },
    resume:       { type: 'boolean', default: false },
  },
})

const MAX_CASES = parseInt(values['max-cases']!, 10)
const MAX_PAGES = parseInt(values['max-pages']!, 10)
const ALLOWED_IMPORTANCE = new Set(values.importance!.split(',').map(s => s.trim()))
const ALLOWED_BRANCHES = new Set(values.branches!.split(',').map(s => s.trim()))
const resumeMode = values.resume!

const PAGE_SIZE = 500
const REQ_DELAY_MS = 600
const MAX_CHARS_PER_CHUNK = 3000

const OUTPUT_DIR = 'legal-sources-output/cache/cedh-bulk'
const MERGED_OUT = 'legal-sources-output/cache/cedh-bulk.json'

// Default ranking (XRANK-based) prioritizes landmark judgments by importance and chamber type.
// These older canonical cases are much more likely to have docx conversions available
// than very recent judgments (which use sort=kpdate Descending and get many 204s).
const HUDOC_SEARCH_BASE = 'https://hudoc.echr.coe.int/app/query/results?query=((((((((((((((((((((%20contentsitename%3AECHR%20AND%20(NOT%20(doctype%3DPR%20OR%20doctype%3DHFCOMOLD%20OR%20doctype%3DHECOMOLD)))%20XRANK(cb%3D14)%20doctypebranch%3AGRANDCHAMBER)%20XRANK(cb%3D13)%20doctypebranch%3ADECGRANDCHAMBER)%20XRANK(cb%3D12)%20doctypebranch%3ACHAMBER)%20XRANK(cb%3D11)%20doctypebranch%3AADMISSIBILITY)%20XRANK(cb%3D10)%20doctypebranch%3ACOMMITTEE)%20XRANK(cb%3D9)%20doctypebranch%3AADMISSIBILITYCOM)%20XRANK(cb%3D8)%20doctypebranch%3ADECCOMMISSION)%20XRANK(cb%3D7)%20doctypebranch%3ACOMMUNICATEDCASES)%20XRANK(cb%3D6)%20doctypebranch%3ACLIN)%20XRANK(cb%3D5)%20doctypebranch%3AADVISORYOPINIONS)%20XRANK(cb%3D4)%20doctypebranch%3AREPORTS)%20XRANK(cb%3D3)%20doctypebranch%3AEXECUTION)%20XRANK(cb%3D2)%20doctypebranch%3AMERITS)%20XRANK(cb%3D1)%20doctypebranch%3ASCREENINGPANEL)%20XRANK(cb%3D4)%20importance%3A1)%20XRANK(cb%3D3)%20importance%3A2)%20XRANK(cb%3D2)%20importance%3A3)%20XRANK(cb%3D1)%20importance%3A4)%20XRANK(cb%3D2)%20languageisocode%3AENG)%20XRANK(cb%3D1)%20languageisocode%3AFRE&select=itemid%2Cappno%2Ckpdate%2Cdocname%2Crespondent%2Clanguageisocode%2Cdoctypebranch%2Cimportance&sort=kpdate%20Ascending&rankingModelId=4180000c-8692-45ca-ad63-74bc4163871b'

const UA = 'Mozilla/5.0 (compatible; studykit-crfpa-ingest/1.0)'

function sleep(ms: number): Promise<void> { return new Promise(r => setTimeout(r, ms)) }

interface Chunk {
  id: string
  codeName: string
  num: string
  breadcrumb: string
  text: string
}

interface SearchHit {
  itemid: string
  appno: string
  kpdate: string
  docname: string
  respondent: string
  languageisocode: string
  doctypebranch: string
  importance: string
}

// ─── Enumeration ────────────────────────────────────────

async function enumerate(): Promise<SearchHit[]> {
  mkdirSync(OUTPUT_DIR, { recursive: true })
  const seen = new Map<string, SearchHit>()

  for (let page = 0; page < MAX_PAGES; page++) {
    const cacheFile = join(OUTPUT_DIR, `search-page-${String(page).padStart(3, '0')}.json`)
    let data: { resultcount: number; results?: Array<{ columns: SearchHit }> } | null = null

    if (resumeMode && existsSync(cacheFile)) {
      data = JSON.parse(readFileSync(cacheFile, 'utf-8'))
    } else {
      const url = `${HUDOC_SEARCH_BASE}&start=${page * PAGE_SIZE}&length=${PAGE_SIZE}`
      try {
        const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } })
        if (!res.ok) { console.error(`  page ${page}: HTTP ${res.status}`); break }
        data = await res.json() as { resultcount: number; results?: Array<{ columns: SearchHit }> }
        writeFileSync(cacheFile, JSON.stringify(data))
      } catch (err) {
        console.error(`  page ${page}: ${(err as Error).message?.slice(0, 200)}`)
        break
      }
      await sleep(REQ_DELAY_MS)
    }

    const results = data?.results ?? []
    if (results.length === 0) break

    let kept = 0
    for (const r of results) {
      const c = r.columns
      if (!ALLOWED_BRANCHES.has(c.doctypebranch)) continue
      if (!ALLOWED_IMPORTANCE.has(c.importance)) continue
      if (c.languageisocode !== 'FRE' && c.respondent !== 'FRA') continue
      if (!c.itemid) continue
      if (!seen.has(c.itemid)) {
        seen.set(c.itemid, c)
        kept++
      }
    }

    console.log(`  page ${page + 1}/${MAX_PAGES}: +${kept} relevant (${seen.size}/${MAX_CASES} total)`)
    if (seen.size >= MAX_CASES) break
  }

  return Array.from(seen.values()).slice(0, MAX_CASES)
}

// ─── Fetch + clean ──────────────────────────────────────

function sanitize(html: string): string {
  return html
    // Strip whole blocks first so their CSS/JS doesn't survive as text
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => { try { return String.fromCodePoint(parseInt(h, 16)) } catch { return ' ' } })
    .replace(/&#(\d+);/g, (_, n) => { try { return String.fromCodePoint(parseInt(n, 10)) } catch { return ' ' } })
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/[\uE000-\uF8FF]/g, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .normalize('NFC')
}

async function fetchFullText(itemid: string): Promise<string | null> {
  const cachePath = join(OUTPUT_DIR, `${itemid}.txt`)
  if (existsSync(cachePath)) {
    const cached = readFileSync(cachePath, 'utf-8')
    if (cached.length > 100) return cached
  }
  const url = `https://hudoc.echr.coe.int/app/conversion/docx/html/body?library=ECHR&id=${itemid}&filename=${itemid}.docx&logEvent=False`
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA } })
    if (!res.ok) return null
    const html = await res.text()
    const text = sanitize(html)
    if (text.length < 500) return null
    writeFileSync(cachePath, text)
    return text
  } catch {
    return null
  }
}

// ─── Chunking ───────────────────────────────────────────

function chunkText(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text]
  const parts: string[] = []
  const segments = text.split(/(?=\b(?:EN FAIT|EN DROIT|PAR CES MOTIFS|À L'UNANIMITÉ|LA COUR|La Cour|Article \d+ de la Convention|I\. |II\. |III\. |IV\. |V\. ))/)
  let buf = ''
  for (const seg of segments) {
    if ((buf + seg).length > maxChars && buf) { parts.push(buf.trim()); buf = seg }
    else buf += seg
  }
  if (buf.trim()) parts.push(buf.trim())
  if (parts.length === 1 && parts[0].length > maxChars) {
    parts.length = 0
    for (let i = 0; i < text.length; i += maxChars) parts.push(text.slice(i, i + maxChars))
  }
  return parts
}

function hitToChunks(hit: SearchHit, text: string): Chunk[] {
  const pieces = chunkText(text, MAX_CHARS_PER_CHUNK)
  const date = hit.kpdate.slice(0, 10)
  const branch = hit.doctypebranch === 'GRANDCHAMBER' ? 'GC' : 'Chambre'
  const header = `CEDH ${branch}, ${date}, ${hit.docname}, n° ${hit.appno}\nLangue : ${hit.languageisocode} | Respondent : ${hit.respondent} | Importance : ${hit.importance}`

  return pieces.map((piece, i) => ({
    id: `cedh-bulk-${hit.itemid}${pieces.length > 1 ? `-p${i}` : ''}`.slice(0, 60),
    codeName: `CEDH — ${hit.doctypebranch}`,
    num: hit.appno,
    breadcrumb: `CEDH > ${branch} > ${date} > ${hit.docname.slice(0, 120)}`,
    text: pieces.length > 1 ? `${header} (partie ${i + 1}/${pieces.length})\n\n${piece}` : `${header}\n\n${piece}`,
  }))
}

// ─── Main ───────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('=== ingest-cedh-bulk ===')
  console.log(`  max cases:   ${MAX_CASES}`)
  console.log(`  max pages:   ${MAX_PAGES}`)
  console.log(`  importance:  ${[...ALLOWED_IMPORTANCE].join(',')}`)
  console.log(`  branches:    ${[...ALLOWED_BRANCHES].join(',')}`)
  console.log(`  resume:      ${resumeMode}`)
  console.log()

  console.log('[1/2] Enumerating HUDOC search...')
  const startEnum = Date.now()
  const hits = await enumerate()
  const enumSec = ((Date.now() - startEnum) / 1000).toFixed(0)
  console.log(`  ✓ ${hits.length} unique relevant cases in ${enumSec}s\n`)

  console.log(`[2/2] Fetching full text for ${hits.length} cases...`)
  const startFetch = Date.now()
  const allChunks: Chunk[] = []
  let fetched = 0, failed = 0
  let lastLog = Date.now()

  for (const hit of hits) {
    const text = await fetchFullText(hit.itemid)
    if (text) {
      allChunks.push(...hitToChunks(hit, text))
      fetched++
    } else {
      failed++
    }
    await sleep(REQ_DELAY_MS)
    if (Date.now() - lastLog > 10000) {
      const done = fetched + failed
      const rate = done / ((Date.now() - startFetch) / 1000)
      const eta = Math.round((hits.length - done) / rate)
      console.log(`  ${done}/${hits.length}  (fetched ${fetched}, failed ${failed}, ${rate.toFixed(1)}/s, ETA ${eta}s)`)
      lastLog = Date.now()
    }
  }

  writeFileSync(MERGED_OUT, JSON.stringify(allChunks))

  const fetchSec = ((Date.now() - startFetch) / 1000).toFixed(0)
  console.log(`\n=== Done ===`)
  console.log(`  Cases:    ${hits.length}`)
  console.log(`  Fetched:  ${fetched}`)
  console.log(`  Failed:   ${failed}`)
  console.log(`  Chunks:   ${allChunks.length}`)
  console.log(`  Output:   ${MERGED_OUT}`)
  console.log(`  Elapsed:  enum ${enumSec}s + fetch ${fetchSec}s`)
  console.log(`\nNext:`)
  console.log(`  npx tsx scripts/embed-sources.ts --input ${MERGED_OUT} --output-prefix cedh-bulk`)
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
