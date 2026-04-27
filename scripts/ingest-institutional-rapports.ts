#!/usr/bin/env npx tsx
/* eslint-disable no-console */
/**
 * Ingest official institutional rapports / avis (Tier C):
 *   - Rapport annuel Cour de cassation (2022, 2023, 2024)
 *   - Rapport public Conseil d'État / juridiction administrative (2023, 2024)
 *   - Rapport annuel Défenseur des droits (2024)
 *   - CCNE Rapport d'activité 2024
 *   - CCNE Avis récents (141-150 probed; only landing files checked)
 *
 * URLs curated via WebSearch (Apr 2026). URL patterns can break over time —
 * run this script periodically or refresh the list.
 *
 * Usage:
 *   npx tsx scripts/ingest-institutional-rapports.ts
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import { parseArgs } from 'util'
import { execSync } from 'child_process'
import { type Chunk } from './lib/legifranceClient'

const { values } = parseArgs({
  options: { 'output-dir': { type: 'string', default: 'legal-sources-output' } },
})

const outputDir = values['output-dir']!

interface PdfRef { url: string; title: string; slug: string; breadcrumb: string }

const PDFS: PdfRef[] = [
  // Cour de cassation rapports annuels
  {
    url: 'https://www.vie-publique.fr/files/rapport/pdf/299813.pdf',
    title: 'Rapport annuel 2024 — Cour de cassation (version complète)',
    slug: 'cass-rapport-annuel-2024',
    breadcrumb: 'Rapports institutionnels > Cour de cassation > 2024',
  },
  {
    url: 'https://oos.cloudgouv-eu-west-1.outscale.com/ccqpc-drupal-prd/file/2025-08/Pages_de_rapport-annuel_2024.pdf',
    title: 'Rapport annuel 2024 — Cour de cassation (extrait QPC)',
    slug: 'cass-rapport-annuel-2024-qpc',
    breadcrumb: 'Rapports institutionnels > Cour de cassation > 2024 QPC',
  },
  {
    url: 'https://oos.cloudgouv-eu-west-1.outscale.com/ccqpc-drupal-prd/file/2024-07/Rapport-annuel_Cour-cassation_2023_Qpc.pdf',
    title: 'Rapport annuel 2023 — Cour de cassation (extrait QPC)',
    slug: 'cass-rapport-annuel-2023-qpc',
    breadcrumb: 'Rapports institutionnels > Cour de cassation > 2023 QPC',
  },
  // Conseil d'État rapports publics
  {
    url: 'https://www.conseil-etat.fr/content/download/228336/document/CE_RA_2024_PDFweb_.pdf',
    title: 'Rapport public 2025 — juridiction administrative (activité 2024)',
    slug: 'ce-rapport-public-2024',
    breadcrumb: "Rapports institutionnels > Conseil d'État > activité 2024",
  },
  {
    url: 'https://www.conseil-etat.fr/content/download/213395/document/Rapport%20d%27activit%C3%A9%202023%20de%20la%20juridiction%20administrative.pdf',
    title: "Rapport public 2024 — juridiction administrative (activité 2023)",
    slug: 'ce-rapport-public-2023',
    breadcrumb: "Rapports institutionnels > Conseil d'État > activité 2023",
  },
  // Défenseur des droits
  {
    url: 'https://www.defenseurdesdroits.fr/sites/default/files/2025-03/ddd_rapport-annuel-2024_20250305.pdf',
    title: "Défenseur des droits — Rapport annuel d'activité 2024",
    slug: 'ddd-rapport-annuel-2024',
    breadcrumb: "Rapports institutionnels > Défenseur des droits > 2024",
  },
  // CCNE
  {
    url: 'https://www.ccne-ethique.fr/rapport2024/CCNE-RA2024-RGAA.pdf',
    title: "CCNE — Rapport d'activité 2024",
    slug: 'ccne-rapport-annuel-2024',
    breadcrumb: "Rapports institutionnels > CCNE > 2024",
  },
  {
    url: 'https://www.ccne-ethique.fr/sites/default/files/2025-03/Avis%20149.pdf',
    title: "CCNE Avis n° 149 — baisse de la natalité et de la fertilité",
    slug: 'ccne-avis-149',
    breadcrumb: "Rapports institutionnels > CCNE > Avis 149",
  },
  {
    url: 'https://www.ccne-ethique.fr/sites/default/files/2025-03/Avis%20148.pdf',
    title: "CCNE Avis n° 148 — vulnérabilité face aux progrès médicaux",
    slug: 'ccne-avis-148',
    breadcrumb: "Rapports institutionnels > CCNE > Avis 148",
  },
  {
    url: 'https://www.ccne-ethique.fr/sites/default/files/2021-02/avis_129_vf.pdf',
    title: "CCNE Avis n° 129 — enjeux éthiques du numérique en santé",
    slug: 'ccne-avis-129',
    breadcrumb: "Rapports institutionnels > CCNE > Avis 129",
  },
]

async function downloadPdf(url: string, destPath: string): Promise<boolean> {
  if (existsSync(destPath)) return true
  try {
    execSync(`/usr/bin/curl -sL --max-time 120 -A "corpus-ingest/1.0" -o ${JSON.stringify(destPath)} ${JSON.stringify(url)}`)
    if (!existsSync(destPath)) return false
    // Reject if it's HTML (404 disguised)
    const head = execSync(`head -c 8 ${JSON.stringify(destPath)}`, { encoding: 'utf-8' })
    if (!head.startsWith('%PDF')) return false
    return true
  } catch {
    return false
  }
}

function extractPdfText(pdfPath: string): string {
  try {
    return execSync(`node scripts/lib/pdf-dump.cjs ${JSON.stringify(pdfPath)}`, {
      maxBuffer: 500 * 1024 * 1024,
      encoding: 'utf-8',
    })
  } catch {
    return ''
  }
}

function chunkText(raw: string, ref: PdfRef): Chunk[] {
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
        breadcrumb: ref.breadcrumb,
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

async function main() {
  console.log(`=== Institutional rapports ingest (${PDFS.length} PDFs) ===`)
  const pdfDir = join(outputDir, 'cache', 'institutional-rapports')
  mkdirSync(pdfDir, { recursive: true })
  mkdirSync(join(outputDir, 'cache'), { recursive: true })
  mkdirSync(join(outputDir, 'chunks'), { recursive: true })

  const all: Chunk[] = []
  for (const ref of PDFS) {
    console.log(`\n${ref.title}`)
    const pdfPath = join(pdfDir, `${ref.slug}.pdf`)
    const ok = await downloadPdf(ref.url, pdfPath)
    if (!ok) {
      console.log(`  ⚠ download failed or not a PDF`)
      continue
    }
    const text = extractPdfText(pdfPath)
    if (!text) {
      console.log('  ⚠ extract failed')
      continue
    }
    console.log(`  PDF text: ${text.length} chars`)
    const chunks = chunkText(text, ref)
    console.log(`  → ${chunks.length} chunks`)
    all.push(...chunks)
  }

  const chunksPath = join(outputDir, 'chunks', 'institutional-rapports.json')
  const cachePath = join(outputDir, 'cache', 'institutional-rapports.json')
  writeFileSync(chunksPath, JSON.stringify(all))
  writeFileSync(cachePath, JSON.stringify(all))
  console.log(`\n=== Done ===`)
  console.log(`Total chunks: ${all.length}`)
  console.log(`→ ${chunksPath}`)
}

main().catch((err) => { console.error('Fatal:', err); process.exit(1) })
