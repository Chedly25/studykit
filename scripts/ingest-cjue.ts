#!/usr/bin/env npx tsx
/* eslint-disable no-console */
/**
 * Bulk ingest CJUE (Cour de justice de l'UE) judgments from EUR-Lex.
 *
 * Path: SPARQL enumeration → CELLAR manifestation fetch → HTML strip → chunk.
 * Only CJUE judgments (CELEX pattern ^6YYYYCJNNNN$) in French.
 *
 * Usage:
 *   npx tsx scripts/ingest-cjue.ts [--from 1954-01-01] [--to 2026-12-31] [--resume]
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync, appendFileSync } from 'fs'
import { join } from 'path'
import { parseArgs } from 'util'
import { sleep, slugify, type Chunk } from './lib/legifranceClient'

const { values } = parseArgs({
  options: {
    'output-dir': { type: 'string', default: 'legal-sources-output' },
    'from': { type: 'string', default: '1954-01-01' },
    'to': { type: 'string', default: new Date().toISOString().slice(0, 10) },
    'resume': { type: 'boolean', default: false },
    'limit': { type: 'string' },
    'max-chunks-per-file': { type: 'string', default: '50000' },
  },
})

const outputDir = values['output-dir']!
const fromISO = values['from']!
const toISO = values['to']!
const resume = values['resume']!
const limitN = values['limit'] ? Number(values['limit']) : null
const MAX_CHUNKS_PER_FILE = Number(values['max-chunks-per-file'])

const SPARQL = 'https://publications.europa.eu/webapi/rdf/sparql'
const cacheDir = join(outputDir, 'cache')
const chunksDir = join(outputDir, 'chunks')
const seenLog = join(cacheDir, 'cjue.seen')
mkdirSync(cacheDir, { recursive: true })
mkdirSync(chunksDir, { recursive: true })

const seen = new Set<string>()
if (resume && existsSync(seenLog)) {
  for (const l of readFileSync(seenLog, 'utf-8').split('\n')) if (l.trim()) seen.add(l.trim())
  console.log(`Resume: ${seen.size} CELEX already processed`)
}

interface CjueWork {
  celex: string
  date: string
  manif: string
}

async function sparqlSelect(query: string): Promise<Array<Record<string, string>>> {
  // POST to avoid URL length limits; disable gzip to sidestep node CompressionStream OOM
  const r = await fetch(SPARQL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/sparql-results+json',
      'Accept-Encoding': 'identity',
    },
    body: new URLSearchParams({ query }),
  })
  if (!r.ok) {
    const txt = await r.text().catch(() => '')
    throw new Error(`SPARQL ${r.status}: ${txt.slice(0, 200)}`)
  }
  const j = (await r.json()) as { results: { bindings: Array<Record<string, { value: string }>> } }
  return j.results.bindings.map((b) => {
    const row: Record<string, string> = {}
    for (const k of Object.keys(b)) row[k] = b[k].value
    return row
  })
}

async function listCjueJudgmentsPaged(
  fromDate: string,
  toDate: string,
  pageSize = 500,
): Promise<CjueWork[]> {
  const out: CjueWork[] = []
  let offset = 0
   
  while (true) {
    const q = `
PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
PREFIX lang: <http://publications.europa.eu/resource/authority/language/>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
SELECT DISTINCT ?celex ?date ?manif WHERE {
  ?work cdm:resource_legal_id_celex ?celex .
  ?work cdm:work_date_document ?date .
  ?exp cdm:expression_belongs_to_work ?work .
  ?exp cdm:expression_uses_language lang:FRA .
  ?manif cdm:manifestation_manifests_expression ?exp .
  ?manif cdm:manifestation_type "html"^^xsd:string .
  FILTER(REGEX(STR(?celex), "^6[0-9]{4}CJ[0-9]+$"))
  FILTER(?date >= "${fromDate}"^^xsd:date && ?date <= "${toDate}"^^xsd:date)
}
ORDER BY ?date ?celex
OFFSET ${offset} LIMIT ${pageSize}
`
    const rows = await sparqlSelect(q)
    for (const r of rows) out.push({ celex: r.celex, date: r.date, manif: r.manif })
    if (rows.length < pageSize) break
    offset += pageSize
    await sleep(400)
  }
  return out
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&eacute;/g, 'é')
    .replace(/&egrave;/g, 'è')
    .replace(/&ecirc;/g, 'ê')
    .replace(/&agrave;/g, 'à')
    .replace(/&acirc;/g, 'â')
    .replace(/&ccedil;/g, 'ç')
    .replace(/&ugrave;/g, 'ù')
    .replace(/&ucirc;/g, 'û')
    .replace(/&ocirc;/g, 'ô')
    .replace(/&icirc;/g, 'î')
    .replace(/&iuml;/g, 'ï')
    .replace(/&euml;/g, 'ë')
    .replace(/&auml;/g, 'ä')
    .replace(/&ouml;/g, 'ö')
    .replace(/&uuml;/g, 'ü')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b-\u001f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function fetchHtml(url: string, retries = 3): Promise<string | null> {
  for (let i = 0; i < retries; i++) {
    try {
      const r = await fetch(url, {
        headers: {
          Accept: 'text/html',
          'User-Agent': 'corpus-ingest/1.0',
          'Accept-Encoding': 'identity',
        },
        redirect: 'follow',
      })
      if (r.status === 200) {
        const len = Number(r.headers.get('content-length') ?? '0')
        if (len > 5_000_000) {
          console.warn(`  skip oversized manifestation (${len} bytes): ${url}`)
          return null
        }
        return await r.text()
      }
      if (r.status === 404) return null
      await sleep(1000 * (i + 1))
    } catch (e) {
      console.warn(`  fetch err (try ${i + 1}): ${(e as Error).message.slice(0, 100)}`)
      await sleep(1000 * (i + 1))
    }
  }
  return null
}

function chunkText(text: string, celex: string, date: string): Chunk[] {
  const CHUNK_SIZE = 2000
  const CHUNK_OVERLAP = 200
  const chunks: Chunk[] = []
  const breadcrumb = `CJUE • ${date.slice(0, 10)} • ${celex}`
  const codeName = 'Jurisprudence — Cour de justice de l\'Union européenne'
  if (text.length <= CHUNK_SIZE) {
    chunks.push({ id: `cjue-${slugify(celex)}`, codeName, num: celex, breadcrumb, text })
    return chunks
  }
  let start = 0
  let partIdx = 0
  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length)
    let cutEnd = end
    if (end < text.length) {
      const lastSpace = text.lastIndexOf(' ', end)
      if (lastSpace > start + CHUNK_SIZE / 2) cutEnd = lastSpace
    }
    const slice = text.slice(start, cutEnd).trim()
    if (slice.length > 50) {
      chunks.push({
        id: `cjue-${slugify(celex)}-p${partIdx}`,
        codeName,
        num: celex,
        breadcrumb,
        text: slice,
      })
      partIdx++
    }
    if (cutEnd >= text.length) break
    const next = cutEnd - CHUNK_OVERLAP
    if (next <= start) break
    start = next
  }
  return chunks
}

let fileIndex = 0
let buffer: Chunk[] = []

function flushBuffer(): void {
  if (buffer.length === 0) return
  const name = `cjue-part${String(fileIndex).padStart(3, '0')}.json`
  writeFileSync(join(chunksDir, name), JSON.stringify(buffer))
  // Also copy to cache directory so the main embed chain picks it up
  writeFileSync(join(cacheDir, name), JSON.stringify(buffer))
  console.log(`  flushed ${buffer.length} chunks → ${name}`)
  fileIndex++
  buffer = []
}

async function main() {
  console.log(`=== CJUE ingest ${fromISO} → ${toISO} ===`)

  // Advance fileIndex past existing files
  while (existsSync(join(chunksDir, `cjue-part${String(fileIndex).padStart(3, '0')}.json`))) fileIndex++

  // Enumerate by year window to avoid SPARQL timeouts
  const works: CjueWork[] = []
  const fromYear = Number(fromISO.slice(0, 4))
  const toYear = Number(toISO.slice(0, 4))
  for (let y = fromYear; y <= toYear; y++) {
    const yFrom = `${y}-01-01` < fromISO ? fromISO : `${y}-01-01`
    const yTo = `${y}-12-31` > toISO ? toISO : `${y}-12-31`
    try {
      const batch = await listCjueJudgmentsPaged(yFrom, yTo)
      console.log(`  ${y}: ${batch.length} judgments`)
      works.push(...batch)
      await sleep(500)
    } catch (e) {
      console.warn(`  ${y}: enumeration failed (${(e as Error).message.slice(0, 100)})`)
    }
  }

  const queue = limitN ? works.slice(0, limitN) : works
  console.log(`\nQueue: ${queue.length} CJUE judgments`)

  let processed = 0
  let totalChunks = 0
  for (const w of queue) {
    if (seen.has(w.celex)) continue
    console.log(`[${processed + 1}/${queue.length}] ${w.celex} ... fetching`)
    const html = await fetchHtml(w.manif)
    if (!html) {
      console.log(`  no HTML, skip`)
      appendFileSync(seenLog, w.celex + '\n')
      seen.add(w.celex)
      continue
    }
    console.log(`  html ${html.length}b → stripping`)
    const text = stripHtml(html)
    console.log(`  text ${text.length}b → chunking`)
    if (text.length < 100) {
      appendFileSync(seenLog, w.celex + '\n')
      seen.add(w.celex)
      continue
    }
    const chunks = chunkText(text, w.celex, w.date)
    console.log(`  ${chunks.length} chunks`)
    buffer.push(...chunks)
    totalChunks += chunks.length
    if (buffer.length >= MAX_CHUNKS_PER_FILE) flushBuffer()
    appendFileSync(seenLog, w.celex + '\n')
    seen.add(w.celex)
    processed++
    if (processed % 50 === 0) {
      console.log(`  ${processed}/${queue.length} (chunks so far: ${totalChunks})`)
    }
    await sleep(200)
  }
  flushBuffer()

  console.log(`\n=== Done ===`)
  console.log(`Judgments processed: ${processed}`)
  console.log(`Total chunks: ${totalChunks}`)
  console.log(`Files: cjue-part*.json`)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
