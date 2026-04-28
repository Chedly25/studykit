#!/usr/bin/env npx tsx
/* eslint-disable no-console */
/**
 * Ingest the 12 major French codes that weren't covered by the earlier
 * ingest-extra-codes.ts run. Together with the existing 16, this gets us to
 * 28 codes covering essentially all CRFPA spécialités.
 *
 * Usage:  npx tsx scripts/ingest-major-codes.ts
 *
 * Reads PISTE_OAUTH_CLIENT_ID/SECRET from env. The ingest is incremental:
 * fully-chunked outputs are skipped on re-run.
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'
import {
  fetchTableMatieres,
  fetchArticlesBatch,
  chunkArticles,
  type FetchedArticle,
  type Chunk,
} from './lib/legifranceClient'

const outputDir = 'legal-sources-output'
const clientId = process.env.PISTE_OAUTH_CLIENT_ID
const clientSecret = process.env.PISTE_OAUTH_CLIENT_SECRET

if (!clientId || !clientSecret) {
  console.error('Missing PISTE_OAUTH_CLIENT_ID/SECRET in env. Source .env first.')
  process.exit(1)
}

interface CodeRef { textId: string; title: string; slug: string }

const MAJOR_CODES: CodeRef[] = [
  { textId: 'LEGITEXT000006070721', title: 'Code civil',                                slug: 'code-civil' },
  { textId: 'LEGITEXT000006070719', title: 'Code pénal',                                slug: 'code-penal' },
  { textId: 'LEGITEXT000006070716', title: 'Code de procédure civile',                  slug: 'code-procedure-civile' },
  { textId: 'LEGITEXT000006071154', title: 'Code de procédure pénale',                  slug: 'code-procedure-penale' },
  { textId: 'LEGITEXT000006072050', title: 'Code du travail',                           slug: 'code-travail' },
  { textId: 'LEGITEXT000005634379', title: 'Code de commerce',                          slug: 'code-commerce' },
  { textId: 'LEGITEXT000006069414', title: 'Code de la propriété intellectuelle',      slug: 'code-propriete-intellectuelle' },
  { textId: 'LEGITEXT000006069565', title: 'Code de la consommation',                   slug: 'code-consommation' },
  { textId: 'LEGITEXT000006074096', title: "Code de la construction et de l'habitation", slug: 'code-construction-habitation' },
  { textId: 'LEGITEXT000006074220', title: "Code de l'environnement",                   slug: 'code-environnement' },
  { textId: 'LEGITEXT000006070933', title: 'Code de justice administrative',            slug: 'code-justice-administrative' },
  { textId: 'LEGITEXT000006074075', title: "Code de l'urbanisme",                       slug: 'code-urbanisme' },
]

async function ingestCode(ref: CodeRef): Promise<FetchedArticle[]> {
  const cachePath = join(outputDir, 'cache', `${ref.slug}-raw.json`)
  if (existsSync(cachePath)) {
    console.log(`  Using -raw cache ${cachePath}`)
    return JSON.parse(readFileSync(cachePath, 'utf-8'))
  }
  console.log(`  Fetching table des matières…`)
  const articleInfos = await fetchTableMatieres(ref.textId, clientId!, clientSecret!)
  console.log(`  TOC: ${articleInfos.length} articles`)
  if (articleInfos.length === 0) return []
  const fetched = await fetchArticlesBatch(articleInfos, clientId!, clientSecret!, 8, 250)
  console.log(`  Fetched ${fetched.length}/${articleInfos.length}`)
  writeFileSync(cachePath, JSON.stringify(fetched))
  return fetched
}

async function main() {
  console.log(`=== Major codes ingestion (${MAJOR_CODES.length} codes) ===`)
  mkdirSync(join(outputDir, 'cache'), { recursive: true })
  mkdirSync(join(outputDir, 'chunks'), { recursive: true })

  let totalChunks = 0
  let processedFiles = 0
  for (const ref of MAJOR_CODES) {
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
    if (articles.length === 0) {
      console.log(`  ⚠ no articles fetched, skipping`)
      continue
    }
    const chunks = chunkArticles(articles, ref.title, ref.slug)
    writeFileSync(chunksPath, JSON.stringify(chunks))
    writeFileSync(cachePath, JSON.stringify(chunks))
    console.log(`  → ${chunks.length} chunks at ${cachePath}`)
    totalChunks += chunks.length
    processedFiles++
  }

  console.log(`\n=== Done ===`)
  console.log(`Codes processed (this run): ${processedFiles}`)
  console.log(`Total chunks across all major codes: ${totalChunks}`)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
