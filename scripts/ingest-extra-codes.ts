#!/usr/bin/env npx tsx
/* eslint-disable no-console */
/**
 * Ingest additional French legal codes not covered by ingest-legal-codes.ts.
 * Adds ~13 codes relevant to CRFPA spécialités (public, santé, affaires, social).
 *
 * Usage:
 *   npx tsx scripts/ingest-extra-codes.ts
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { parseArgs } from 'util'
import {
  fetchTableMatieres,
  fetchArticlesBatch,
  chunkArticles,
  slugify,
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

interface CodeRef { textId: string; title: string; slug: string }

const EXTRA_CODES: CodeRef[] = [
  { textId: 'LEGITEXT000006070633', title: 'Code général des collectivités territoriales', slug: 'cgct' },
  { textId: 'LEGITEXT000031366350', title: "Code des relations entre le public et l'administration", slug: 'crpa' },
  { textId: 'LEGITEXT000006072665', title: 'Code de la santé publique', slug: 'code-sante-publique' },
  { textId: 'LEGITEXT000006072026', title: 'Code monétaire et financier', slug: 'code-monetaire-financier' },
  { textId: 'LEGITEXT000006074069', title: "Code de l'action sociale et des familles", slug: 'casf' },
  { textId: 'LEGITEXT000006070299', title: 'Code général de la propriété des personnes publiques', slug: 'cgppp' },
  { textId: 'LEGITEXT000006073984', title: 'Code des assurances', slug: 'code-assurances' },
  { textId: 'LEGITEXT000006071367', title: 'Code rural et de la pêche maritime', slug: 'code-rural' },
  { textId: 'LEGITEXT000023086525', title: 'Code des transports', slug: 'code-transports' },
  { textId: 'LEGITEXT000006071191', title: "Code de l'éducation", slug: 'code-education' },
  { textId: 'LEGITEXT000006070987', title: 'Code des postes et des communications électroniques', slug: 'code-postes' },
  { textId: 'LEGITEXT000006071318', title: 'Code du sport', slug: 'code-sport' },
  { textId: 'LEGITEXT000006071307', title: 'Code de la défense', slug: 'code-defense' },
  // Tier A additions
  { textId: 'LEGITEXT000039086952', title: 'Code de la justice pénale des mineurs (CJPM)', slug: 'cjpm' },
  { textId: 'LEGITEXT000006071164', title: "Code de l'organisation judiciaire (COJ)", slug: 'coj' },
  { textId: 'LEGITEXT000044416551', title: 'Code général de la fonction publique (CGFP)', slug: 'cgfp' },
]

async function ingestCode(ref: CodeRef): Promise<FetchedArticle[]> {
  const cachePath = join(outputDir, 'cache', `${ref.slug}-raw.json`)
  if (existsSync(cachePath)) {
    console.log(`  Using cache ${cachePath}`)
    return JSON.parse(readFileSync(cachePath, 'utf-8'))
  }
  const articleInfos = await fetchTableMatieres(ref.textId, clientId!, clientSecret!)
  console.log(`  TOC: ${articleInfos.length} articles`)
  if (articleInfos.length === 0) return []
  const fetched = await fetchArticlesBatch(articleInfos, clientId!, clientSecret!, 8, 250)
  console.log(`  Fetched ${fetched.length}/${articleInfos.length}`)
  writeFileSync(cachePath, JSON.stringify(fetched))
  return fetched
}

async function main() {
  console.log(`=== Extra codes ingestion (${EXTRA_CODES.length} codes) ===`)
  mkdirSync(join(outputDir, 'cache'), { recursive: true })
  mkdirSync(join(outputDir, 'chunks'), { recursive: true })

  let totalChunks = 0
  for (const ref of EXTRA_CODES) {
    const chunksPath = join(outputDir, 'chunks', `${ref.slug}.json`)
    const cachePath = join(outputDir, 'cache', `${ref.slug}.json`)
    if (existsSync(chunksPath)) {
      const existing = JSON.parse(readFileSync(chunksPath, 'utf-8')) as Chunk[]
      console.log(`\n${ref.title} — already chunked (${existing.length} chunks), skip`)
      totalChunks += existing.length
      continue
    }
    console.log(`\n${ref.title} (${ref.textId})`)
    const articles = await ingestCode(ref)
    if (articles.length === 0) continue
    const chunks = chunkArticles(articles, ref.title, ref.slug)
    writeFileSync(chunksPath, JSON.stringify(chunks))
    writeFileSync(cachePath, JSON.stringify(chunks))
    console.log(`  → ${chunks.length} chunks`)
    totalChunks += chunks.length
  }

  console.log(`\n=== Done ===`)
  console.log(`Total chunks: ${totalChunks}`)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})

void slugify
