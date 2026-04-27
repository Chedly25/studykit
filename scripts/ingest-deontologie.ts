#!/usr/bin/env npx tsx
/* eslint-disable no-console */
/**
 * Ingest lawyer déontologie texts (Loi 1971, Décret 1991, Décret 2005).
 *
 * RIN (Règlement Intérieur National) is not on Legifrance — lives on
 * cnb.avocat.fr as PDF; left for a follow-up.
 *
 * Usage:
 *   npx tsx scripts/ingest-deontologie.ts
 * (uses PISTE_OAUTH_CLIENT_ID / PISTE_OAUTH_CLIENT_SECRET from env)
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

const outputDir = values['output-dir'] ?? 'legal-sources-output'
const clientId = values['piste-client-id'] ?? process.env.PISTE_OAUTH_CLIENT_ID
const clientSecret = values['piste-client-secret'] ?? process.env.PISTE_OAUTH_CLIENT_SECRET

if (!clientId || !clientSecret) {
  console.error('Missing PISTE credentials.')
  process.exit(1)
}

interface TextRef {
  textId: string
  title: string
  slug: string
}

const TEXTS: TextRef[] = [
  {
    textId: 'LEGITEXT000006068396',
    title: 'Loi n° 71-1130 du 31 décembre 1971 (professions judiciaires)',
    slug: 'loi-71-1130',
  },
  {
    textId: 'LEGITEXT000006078311',
    title: "Décret n° 91-1197 du 27 novembre 1991 (profession d'avocat)",
    slug: 'decret-91-1197',
  },
  {
    textId: 'LEGITEXT000006052004',
    title: "Décret n° 2005-790 du 12 juillet 2005 (déontologie avocat)",
    slug: 'decret-2005-790',
  },
]

async function ingestText(ref: TextRef, cId: string, cSecret: string): Promise<FetchedArticle[]> {
  console.log(`\n${ref.title}`)
  const cachePath = join(outputDir, 'cache', `${ref.slug}.json`)
  if (existsSync(cachePath)) {
    console.log(`  Using cache ${cachePath}`)
    return JSON.parse(readFileSync(cachePath, 'utf-8'))
  }
  const articleInfos = await fetchLegiPart(ref.textId, cId, cSecret)
  console.log(`  TOC: ${articleInfos.length} articles`)
  if (articleInfos.length === 0) {
    console.log('  ⚠ skip')
    return []
  }
  const fetched = await fetchArticlesBatch(articleInfos, cId, cSecret, 8, 250)
  console.log(`  Fetched ${fetched.length}/${articleInfos.length}`)
  writeFileSync(cachePath, JSON.stringify(fetched))
  return fetched
}

async function main() {
  console.log('=== Déontologie avocat ingestion ===')
  mkdirSync(join(outputDir, 'cache'), { recursive: true })
  mkdirSync(join(outputDir, 'chunks'), { recursive: true })

  const allChunks: Chunk[] = []
  for (const ref of TEXTS) {
    const articles = await ingestText(ref, clientId!, clientSecret!)
    const chunks = chunkArticles(articles, ref.title, ref.slug)
    console.log(`  Chunks: ${chunks.length}`)
    allChunks.push(...chunks)
  }

  const chunksPath = join(outputDir, 'chunks', 'deontologie.json')
  writeFileSync(chunksPath, JSON.stringify(allChunks))

  console.log(`\n=== Done ===`)
  console.log(`Total chunks: ${allChunks.length}`)
  console.log(`→ ${chunksPath}`)
  console.log('\nRIN (Règlement Intérieur National) not ingested — CNB PDF; follow-up needed.')
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
