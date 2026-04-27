#!/usr/bin/env npx tsx
/* eslint-disable no-console */
/**
 * Ingest major non-codified French laws that a CRFPA student encounters
 * constantly but that never made it into a code.
 *
 * Usage:
 *   npx tsx scripts/ingest-lois-non-codifiees.ts
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { parseArgs } from 'util'
import {
  fetchLegiPart,
  fetchArticlesBatch,
  chunkArticles,
  type FetchedArticle,
  type Chunk,
} from './lib/legifranceClient'

const { values } = parseArgs({
  options: {
    'output-dir': { type: 'string', default: 'legal-sources-output' },
    'piste-client-id': { type: 'string' },
    'piste-client-secret': { type: 'string' },
  },
})

const outputDir = values['output-dir']!
const clientId = values['piste-client-id'] ?? process.env.PISTE_OAUTH_CLIENT_ID
const clientSecret = values['piste-client-secret'] ?? process.env.PISTE_OAUTH_CLIENT_SECRET

if (!clientId || !clientSecret) {
  console.error('Missing PISTE credentials.')
  process.exit(1)
}

interface LoiRef { textId: string; title: string; slug: string }

const LOIS: LoiRef[] = [
  { textId: 'LEGITEXT000006068902', title: 'Loi n° 85-677 du 5 juillet 1985 (loi Badinter — victimes accidents circulation)', slug: 'loi-badinter-1985' },
  { textId: 'LEGITEXT000006068624', title: 'Loi n° 78-17 du 6 janvier 1978 (Informatique, fichiers et libertés — CNIL)', slug: 'loi-cnil-1978' },
  { textId: 'LEGITEXT000037086729', title: 'Loi n° 2018-493 du 20 juin 2018 (Protection des données personnelles — RGPD)', slug: 'loi-rgpd-2018' },
  { textId: 'LEGITEXT000005632379', title: 'Loi n° 2002-303 du 4 mars 2002 (Droits des malades — loi Kouchner)', slug: 'loi-kouchner-2002' },
  { textId: 'LEGITEXT000006070722', title: 'Loi du 29 juillet 1881 sur la liberté de la presse', slug: 'loi-1881-presse' },
  { textId: 'LEGITEXT000006070169', title: "Loi du 9 décembre 1905 (Séparation des Églises et de l'État)", slug: 'loi-1905-laicite' },
]

async function ingest(ref: LoiRef): Promise<FetchedArticle[]> {
  console.log(`\n${ref.title}`)
  const cachePath = join(outputDir, 'cache', `${ref.slug}-raw.json`)
  if (existsSync(cachePath)) {
    console.log(`  Using cache ${cachePath}`)
    return JSON.parse(readFileSync(cachePath, 'utf-8'))
  }
  const infos = await fetchLegiPart(ref.textId, clientId!, clientSecret!)
  console.log(`  TOC: ${infos.length} articles`)
  if (infos.length === 0) return []
  const fetched = await fetchArticlesBatch(infos, clientId!, clientSecret!, 8, 250)
  console.log(`  Fetched ${fetched.length}/${infos.length}`)
  writeFileSync(cachePath, JSON.stringify(fetched))
  return fetched
}

async function main() {
  console.log(`=== Lois non-codifiées (${LOIS.length} textes) ===`)
  mkdirSync(join(outputDir, 'cache'), { recursive: true })
  mkdirSync(join(outputDir, 'chunks'), { recursive: true })

  const all: Chunk[] = []
  for (const ref of LOIS) {
    const articles = await ingest(ref)
    if (articles.length === 0) continue
    const chunks = chunkArticles(articles, ref.title, ref.slug)
    console.log(`  → ${chunks.length} chunks`)
    all.push(...chunks)
  }

  const chunksPath = join(outputDir, 'chunks', 'lois-non-codifiees.json')
  const cachePath = join(outputDir, 'cache', 'lois-non-codifiees.json')
  writeFileSync(chunksPath, JSON.stringify(all))
  writeFileSync(cachePath, JSON.stringify(all))

  console.log(`\n=== Done ===`)
  console.log(`Total chunks: ${all.length}`)
  console.log(`→ ${chunksPath}`)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
