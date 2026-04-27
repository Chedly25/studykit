#!/usr/bin/env npx tsx
/* eslint-disable no-console */
/**
 * Ingest a curated list of grands arrêts historiques (pre-Judilibre era).
 *
 * For each arrêt in the seed list:
 *   1. Emit a "reference" chunk (name, court, date, citation, portée, attendu).
 *   2. If a Wikipedia slug is provided, fetch the French Wikipedia article,
 *      strip boilerplate, and emit "body" chunks — attributed per CC-BY-SA.
 *
 * Source: fr.wikipedia.org (CC-BY-SA) + curated public-domain extracts.
 *
 * Usage:
 *   npx tsx scripts/ingest-grands-arrets.ts
 */

import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { parseArgs } from 'util'
import { sleep, type Chunk } from './lib/legifranceClient'
import { GRANDS_ARRETS, type GrandArret } from './data/grandsArretsSeed'

const { values } = parseArgs({
  options: {
    'output-dir': { type: 'string', default: 'legal-sources-output' },
  },
})

const outputDir = values['output-dir']!
const cacheDir = join(outputDir, 'cache')
const chunksDir = join(outputDir, 'chunks')
mkdirSync(cacheDir, { recursive: true })
mkdirSync(chunksDir, { recursive: true })

async function fetchWikipediaPlaintext(slug: string): Promise<string | null> {
  // Wikipedia REST API: plain-text extract
  const url = `https://fr.wikipedia.org/w/api.php?action=query&format=json&titles=${encodeURIComponent(slug)}&prop=extracts&explaintext=1&exsectionformat=plain&redirects=1`
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'corpus-ingest/1.0 (study)' } })
    if (!r.ok) return null
    const j = (await r.json()) as { query?: { pages?: Record<string, { extract?: string }> } }
    const pages = j.query?.pages ?? {}
    for (const p of Object.values(pages)) {
      const txt = p.extract?.trim()
      if (txt && txt.length > 200) return txt
    }
    return null
  } catch {
    return null
  }
}

function referenceChunk(arret: GrandArret): Chunk {
  const parts = [
    `Grand arrêt : ${arret.name}`,
    `${arret.court} — ${arret.date}`,
    arret.citation ? `Citation : ${arret.citation}` : '',
    `Matière : ${arret.subject}`,
    `Portée : ${arret.portee}`,
    arret.attendu ? `\nExtrait de la décision :\n${arret.attendu}` : '',
  ].filter(Boolean)
  return {
    id: `grand-arret-${arret.slug}-ref`,
    codeName: 'Grands arrêts',
    num: arret.slug,
    breadcrumb: `Grands arrêts > ${arret.subject} > ${arret.court}`,
    text: parts.join('\n'),
  }
}

function splitWikiIntoChunks(
  wikiText: string,
  arret: GrandArret,
): Chunk[] {
  // Chunk by ~1500 char windows on paragraph boundaries
  const MAX = 1500
  const paragraphs = wikiText.split(/\n\n+/).filter((p) => p.trim().length > 40)
  const chunks: Chunk[] = []
  let buffer = ''
  let partIdx = 0
  const pushBuffer = () => {
    if (buffer.trim().length < 80) return
    chunks.push({
      id: `grand-arret-${arret.slug}-wiki-p${partIdx}`,
      codeName: 'Grands arrêts',
      num: arret.slug,
      breadcrumb: `Grands arrêts > ${arret.subject} > ${arret.court} > contexte (Wikipédia CC-BY-SA)`,
      text: `Contexte doctrinal (${arret.name}, ${arret.court} ${arret.date}) — source : Wikipédia (CC-BY-SA)\n\n${buffer.trim()}`,
    })
    partIdx++
    buffer = ''
  }
  for (const para of paragraphs) {
    const candidate = buffer ? `${buffer}\n\n${para}` : para
    if (candidate.length > MAX && buffer) {
      pushBuffer()
      buffer = para
    } else {
      buffer = candidate
    }
  }
  pushBuffer()
  return chunks
}

async function main() {
  console.log(`=== Grands arrêts ingest (${GRANDS_ARRETS.length} cases) ===\n`)
  const allChunks: Chunk[] = []
  let wikiOk = 0
  let wikiMiss = 0
  for (const arret of GRANDS_ARRETS) {
    // Reference chunk always
    allChunks.push(referenceChunk(arret))
    if (arret.wikipediaSlug) {
      const txt = await fetchWikipediaPlaintext(arret.wikipediaSlug)
      if (txt) {
        const wikiChunks = splitWikiIntoChunks(txt, arret)
        allChunks.push(...wikiChunks)
        wikiOk++
        console.log(`✓ ${arret.name} (wiki: ${wikiChunks.length} chunks)`)
      } else {
        wikiMiss++
        console.log(`· ${arret.name} (wiki miss)`)
      }
      await sleep(150)
    } else {
      console.log(`· ${arret.name} (ref only)`)
    }
  }

  const chunksPath = join(chunksDir, 'grands-arrets.json')
  writeFileSync(chunksPath, JSON.stringify(allChunks))
  // Also drop in cache so the embed chain picks it up
  writeFileSync(join(cacheDir, 'grands-arrets.json'), JSON.stringify(allChunks))

  console.log(`\n=== Done ===`)
  console.log(`Cases: ${GRANDS_ARRETS.length}`)
  console.log(`Wikipedia body retrieved: ${wikiOk}, missed: ${wikiMiss}`)
  console.log(`Total chunks: ${allChunks.length}`)
  console.log(`→ ${chunksPath}`)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
