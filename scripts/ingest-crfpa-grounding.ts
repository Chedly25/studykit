#!/usr/bin/env npx tsx
/* eslint-disable no-console */
/**
 * Ingest official CRFPA exam grounding material:
 *   - Rapports de la Commission Nationale de l'examen (CNB PDFs)
 *   - Arrêté du 17 octobre 2016 fixant le programme + modifying arrêtés
 *   - Décret n° 2016-1389 (conditions d'accès)
 *
 * This material is what exam generators should be grounded against:
 *   - Programme des matières (which topics by spécialité)
 *   - Modalités d'épreuve (format, length, coefficient)
 *   - Commission rapports (what the jury expects, common mistakes)
 *
 * Usage:
 *   npx tsx scripts/ingest-crfpa-grounding.ts
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { parseArgs } from 'util'
import { execSync } from 'child_process'
import {
  fetchLegiPart,
  fetchArticlesBatch,
  chunkArticles,
  type Chunk,
  type FetchedArticle,
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

// ─── Legifrance texts (arrêtés + décret) ───────────────

interface TextRef { textId: string; title: string; slug: string }

const LEGI_TEXTS: TextRef[] = [
  { textId: 'LEGITEXT000033254441', title: "Arrêté du 17 octobre 2016 fixant le programme et les modalités de l'examen d'accès au CRFPA", slug: 'arrete-17-oct-2016-crfpa' },
  { textId: 'LEGITEXT000033254334', title: "Décret n° 2016-1389 du 17 octobre 2016 modifiant les conditions d'accès aux CRFPA", slug: 'decret-2016-1389' },
  { textId: 'LEGITEXT000037494356', title: "Arrêté du 2 octobre 2018 modifiant l'arrêté du 17 octobre 2016", slug: 'arrete-2-oct-2018-crfpa-mod' },
  { textId: 'LEGITEXT000044403049', title: "Arrêté du 17 novembre 2021 modifiant l'arrêté du 17 octobre 2016", slug: 'arrete-17-nov-2021-crfpa-mod' },
  { textId: 'LEGITEXT000049680878', title: "Arrêté du 31 mai 2024 modifiant l'arrêté du 17 octobre 2016", slug: 'arrete-31-mai-2024-crfpa-mod' },
  { textId: 'LEGITEXT000050482841', title: "Arrêté du 7 novembre 2024 modifiant l'arrêté du 17 octobre 2016", slug: 'arrete-7-nov-2024-crfpa-mod' },
]

async function ingestLegiText(ref: TextRef): Promise<Chunk[]> {
  console.log(`\n${ref.title}`)
  const cachePath = join(outputDir, 'cache', `${ref.slug}-raw.json`)
  let articles: FetchedArticle[]
  if (existsSync(cachePath)) {
    articles = JSON.parse(readFileSync(cachePath, 'utf-8'))
    console.log(`  cache ${articles.length} articles`)
  } else {
    const infos = await fetchLegiPart(ref.textId, clientId!, clientSecret!)
    console.log(`  TOC: ${infos.length}`)
    articles = await fetchArticlesBatch(infos, clientId!, clientSecret!, 6, 250)
    console.log(`  fetched ${articles.length}`)
    writeFileSync(cachePath, JSON.stringify(articles))
  }
  if (articles.length === 0) return []
  const chunks = chunkArticles(articles, ref.title, ref.slug)
  console.log(`  → ${chunks.length} chunks`)
  return chunks
}

// ─── CNB rapports (PDFs) ───────────────────────────────

interface PdfRef { url: string; title: string; slug: string }

const RAPPORTS: PdfRef[] = [
  {
    url: 'https://cnb.avocat.fr/medias/file/crfparapport-de-la-commission-nationale-2025-69a7f281caf229.08205902.pdf',
    title: 'Rapport de la Commission Nationale CRFPA — Session 2025',
    slug: 'cnb-rapport-crfpa-2025',
  },
  {
    url: 'https://cnb.avocat.fr/medias/file/crfparapport-de-la-commission-nationale-2023-2024-69a7f418c4bfc9.54285126.pdf',
    title: 'Rapport de la Commission Nationale CRFPA — Sessions 2023-2024',
    slug: 'cnb-rapport-crfpa-2023-2024',
  },
  {
    url: 'https://cnb.avocat.fr/medias/file/joe2026041200870045-69dce0d3ed5972.06664532.pdf',
    title: "Arrêté du 2 mars 2026 fixant les dates et horaires de l'examen d'accès au CRFPA session 2026",
    slug: 'cnb-arrete-dates-crfpa-2026',
  },
  {
    url: 'https://cnb.avocat.fr/medias/file/arrete-du-11-mars-2025-dates-d-examen0-698cb16fe260e3.61211662.pdf',
    title: "Arrêté du 11 mars 2025 fixant les dates et horaires de l'examen d'accès au CRFPA session 2025",
    slug: 'cnb-arrete-dates-crfpa-2025',
  },
]

async function downloadPdf(url: string, destPath: string): Promise<boolean> {
  if (existsSync(destPath)) return true
  try {
    execSync(`/usr/bin/curl -sL --max-time 60 -o ${JSON.stringify(destPath)} ${JSON.stringify(url)}`)
    return existsSync(destPath)
  } catch {
    return false
  }
}

async function extractPdfText(pdfPath: string): Promise<string> {
  // Shell out to the PDF dumper script so we don't have to wrangle ESM/CJS interop inline.
  try {
    const out = execSync(`node scripts/lib/pdf-dump.cjs ${JSON.stringify(pdfPath)}`, {
      maxBuffer: 50 * 1024 * 1024,
      encoding: 'utf-8',
    })
    return out
  } catch {
    return ''
  }
}

function chunkPdfText(raw: string, ref: PdfRef): Chunk[] {
  const text = raw
    .replace(/-- \d+ of \d+ --/g, '\n')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b-\u001f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const MAX = 1800
  const OVERLAP = 150
  const chunks: Chunk[] = []
  if (text.length < 80) return chunks
  let start = 0
  let part = 0
  while (start < text.length) {
    const end = Math.min(start + MAX, text.length)
    let cutEnd = end
    if (end < text.length) {
      const lastSpace = text.lastIndexOf(' ', end)
      if (lastSpace > start + MAX / 2) cutEnd = lastSpace
    }
    const slice = text.slice(start, cutEnd).trim()
    if (slice.length > 80) {
      chunks.push({
        id: `${ref.slug}-p${part}`,
        codeName: ref.title,
        num: ref.slug,
        breadcrumb: `CRFPA grounding > CNB rapport > ${ref.title}`,
        text: slice,
      })
      part++
    }
    if (cutEnd >= text.length) break
    const next = cutEnd - OVERLAP
    if (next <= start) break
    start = next
  }
  return chunks
}

async function ingestRapport(ref: PdfRef): Promise<Chunk[]> {
  console.log(`\n${ref.title}`)
  const pdfDir = join(outputDir, 'cache', 'crfpa-rapports')
  mkdirSync(pdfDir, { recursive: true })
  const pdfPath = join(pdfDir, `${ref.slug}.pdf`)
  const ok = await downloadPdf(ref.url, pdfPath)
  if (!ok) {
    console.log('  ⚠ download failed')
    return []
  }
  const text = await extractPdfText(pdfPath)
  console.log(`  PDF text: ${text.length} chars`)
  const chunks = chunkPdfText(text, ref)
  console.log(`  → ${chunks.length} chunks`)
  return chunks
}

async function main() {
  console.log('=== CRFPA grounding ingest ===')
  mkdirSync(join(outputDir, 'cache'), { recursive: true })
  mkdirSync(join(outputDir, 'chunks'), { recursive: true })

  const all: Chunk[] = []
  for (const ref of LEGI_TEXTS) {
    all.push(...(await ingestLegiText(ref)))
  }
  for (const ref of RAPPORTS) {
    all.push(...(await ingestRapport(ref)))
  }

  const chunksPath = join(outputDir, 'chunks', 'crfpa-grounding.json')
  const cachePath = join(outputDir, 'cache', 'crfpa-grounding.json')
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
