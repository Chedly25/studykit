#!/usr/bin/env npx tsx
/* eslint-disable no-console */
/**
 * Ingest key EU regulations directly applicable in French law.
 * Uses SPARQL (EUR-Lex CELLAR) to find French HTML manifestations.
 *
 * Scope:
 *   - RGPD (Règlement 2016/679)
 *   - Bruxelles I bis (Règlement 1215/2012)
 *   - Rome I (Règlement 593/2008)
 *   - Rome II (Règlement 864/2007)
 *
 * Usage:
 *   npx tsx scripts/ingest-eu-regulations.ts
 */

import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { parseArgs } from 'util'
import { sleep, type Chunk } from './lib/legifranceClient'

const { values } = parseArgs({
  options: { 'output-dir': { type: 'string', default: 'legal-sources-output' } },
})

const outputDir = values['output-dir']!
const SPARQL = 'https://publications.europa.eu/webapi/rdf/sparql'

interface RegRef { celex: string; title: string; slug: string }

const REGS: RegRef[] = [
  { celex: '32016R0679', title: 'RGPD — Règlement (UE) 2016/679 (protection des données personnelles)', slug: 'rgpd' },
  { celex: '32012R1215', title: 'Bruxelles I bis — Règlement (UE) n° 1215/2012 (compétence judiciaire, reconnaissance exécution)', slug: 'bruxelles-1-bis' },
  { celex: '32008R0593', title: 'Rome I — Règlement (CE) n° 593/2008 (loi applicable aux obligations contractuelles)', slug: 'rome-1' },
  { celex: '32007R0864', title: 'Rome II — Règlement (CE) n° 864/2007 (loi applicable aux obligations non contractuelles)', slug: 'rome-2' },
]

async function findFrenchHtmlManifestation(celex: string): Promise<string | null> {
  // EU regulations are stored as xhtml (not html). We accept either.
  const query = `
PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
PREFIX lang: <http://publications.europa.eu/resource/authority/language/>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
SELECT ?manif ?type WHERE {
  ?work cdm:resource_legal_id_celex "${celex}"^^xsd:string .
  ?exp cdm:expression_belongs_to_work ?work .
  ?exp cdm:expression_uses_language lang:FRA .
  ?manif cdm:manifestation_manifests_expression ?exp .
  ?manif cdm:manifestation_type ?type .
  FILTER(?type IN ("html"^^xsd:string, "xhtml"^^xsd:string))
}
ORDER BY ?type
LIMIT 1
`
  const r = await fetch(SPARQL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/sparql-results+json' },
    body: new URLSearchParams({ query }),
  })
  if (!r.ok) return null
  const j = (await r.json()) as { results: { bindings: Array<{ manif: { value: string } }> } }
  return j.results.bindings[0]?.manif?.value ?? null
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
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b-\u001f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function chunkText(text: string, title: string, slug: string): Chunk[] {
  const MAX = 2000
  const OVERLAP = 200
  const chunks: Chunk[] = []
  if (text.length <= MAX) {
    chunks.push({ id: `${slug}-p0`, codeName: title, num: slug, breadcrumb: title, text })
    return chunks
  }
  let start = 0, part = 0
  while (start < text.length) {
    const end = Math.min(start + MAX, text.length)
    let cutEnd = end
    if (end < text.length) {
      const lastSpace = text.lastIndexOf(' ', end)
      if (lastSpace > start + MAX / 2) cutEnd = lastSpace
    }
    const slice = text.slice(start, cutEnd).trim()
    if (slice.length > 80) {
      chunks.push({ id: `${slug}-p${part}`, codeName: title, num: slug, breadcrumb: title, text: slice })
      part++
    }
    if (cutEnd >= text.length) break
    const next = cutEnd - OVERLAP
    if (next <= start) break
    start = next
  }
  return chunks
}

async function ingestReg(ref: RegRef): Promise<Chunk[]> {
  console.log(`\n== ${ref.title} ==`)
  const manif = await findFrenchHtmlManifestation(ref.celex)
  if (!manif) {
    console.log(`  ⚠ no French HTML manifestation (CELEX ${ref.celex})`)
    return []
  }
  console.log(`  manif: ${manif}`)
  // EU regulation manifestations are xhtml — requires Accept: application/xhtml+xml.
  const r = await fetch(manif, {
    headers: { Accept: 'application/xhtml+xml', 'User-Agent': 'corpus-ingest/1.0' },
    redirect: 'follow',
  })
  if (!r.ok) {
    console.log(`  ⚠ fetch failed ${r.status}`)
    return []
  }
  const html = await r.text()
  const text = stripHtml(html)
  console.log(`  HTML ${html.length}b → text ${text.length}b`)
  const chunks = chunkText(text, ref.title, ref.slug)
  console.log(`  → ${chunks.length} chunks`)
  return chunks
}

async function main() {
  console.log('=== EU regulations ingestion ===')
  mkdirSync(join(outputDir, 'cache'), { recursive: true })
  mkdirSync(join(outputDir, 'chunks'), { recursive: true })

  const all: Chunk[] = []
  for (const ref of REGS) {
    try {
      all.push(...(await ingestReg(ref)))
    } catch (e) {
      console.error(`${ref.slug} failed: ${(e as Error).message}`)
    }
    await sleep(500)
  }

  const chunksPath = join(outputDir, 'chunks', 'eu-regulations.json')
  const cachePath = join(outputDir, 'cache', 'eu-regulations.json')
  writeFileSync(chunksPath, JSON.stringify(all))
  writeFileSync(cachePath, JSON.stringify(all))

  console.log(`\n=== Done ===`)
  console.log(`Total chunks: ${all.length}`)
  console.log(`→ ${chunksPath}`)
}

main().catch((err) => { console.error('Fatal:', err); process.exit(1) })
