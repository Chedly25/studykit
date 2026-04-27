#!/usr/bin/env npx tsx
/* eslint-disable no-console */
/**
 * Ingest official CRFPA documents: past sujets 2020-2025, official grilles de
 * notation 2025, RIN, and liste documents autorisés.
 *
 * These are the exact materials commission members and correctors use —
 * this is the gold-standard grounding for exam generators + grading prompts.
 *
 * Sources: CNB (sujets, liste autorisés, RIN), Cap'Barreau (mirrors CNB grilles).
 *
 * Usage:
 *   npx tsx scripts/ingest-crfpa-official.ts
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
  // ─── Past sujets 2020-2025 (CNB official) ───────────────────────
  // 2025 (dated by day for 2025 session)
  { url: 'https://www.cnb.avocat.fr/sites/default/files/documents/Note%20de%20synth%C3%A8se%20-%201er%20septembre%2013h.pdf', title: 'Sujet CRFPA 2025 — Note de synthèse', slug: 'sujet-2025-note-synthese', breadcrumb: 'CRFPA sujets officiels > 2025 > note de synthèse' },
  { url: 'https://www.cnb.avocat.fr/sites/default/files/documents/Droit%20des%20obligations%20-%20mardi%202%20septembre%2013h.pdf', title: 'Sujet CRFPA 2025 — Droit des obligations', slug: 'sujet-2025-obligations', breadcrumb: 'CRFPA sujets officiels > 2025 > obligations' },
  { url: 'https://www.cnb.avocat.fr/sites/default/files/documents/Cas%20pratiques-%20mercredi%203%20septembre%2013h.pdf', title: 'Sujet CRFPA 2025 — Cas pratiques (toutes spécialités)', slug: 'sujet-2025-cas-pratiques', breadcrumb: 'CRFPA sujets officiels > 2025 > cas pratiques' },
  { url: 'https://www.cnb.avocat.fr/sites/default/files/documents/Proc%C3%A9dures%20-%20jeudi%204%20septembre%2013h.pdf', title: 'Sujet CRFPA 2025 — Procédures (toutes)', slug: 'sujet-2025-procedures', breadcrumb: 'CRFPA sujets officiels > 2025 > procédures' },
  // 2024
  { url: 'https://www.cnb.avocat.fr/sites/default/files/documents/Note%20de%20synth%C3%A8se%20-sujet%20principal-Examen%20d%27acc%C3%A8s%20CRFPA%202024.pdf', title: 'Sujet CRFPA 2024 — Note de synthèse', slug: 'sujet-2024-note-synthese', breadcrumb: 'CRFPA sujets officiels > 2024 > note de synthèse' },
  { url: 'https://www.cnb.avocat.fr/sites/default/files/documents/Droit%20des%20obligations-%20sujet%20principal-Examen%20d%27acc%C3%A8s%20CRFPA2024_0.pdf', title: 'Sujet CRFPA 2024 — Droit des obligations', slug: 'sujet-2024-obligations', breadcrumb: 'CRFPA sujets officiels > 2024 > obligations' },
  { url: 'https://www.cnb.avocat.fr/sites/default/files/documents/Cas%20pratiques-%20sujets%20principaux-Examen%20d%27acc%C3%A8s%20CRFPA%202024_compressed.pdf', title: 'Sujet CRFPA 2024 — Cas pratiques', slug: 'sujet-2024-cas-pratiques', breadcrumb: 'CRFPA sujets officiels > 2024 > cas pratiques' },
  { url: 'https://www.cnb.avocat.fr/sites/default/files/documents/Proc%C3%A9dures-sujets%20principaux-%20Examen%20d%27acc%C3%A8s%20CRFPA%202024_compressed.pdf', title: 'Sujet CRFPA 2024 — Procédures', slug: 'sujet-2024-procedures', breadcrumb: 'CRFPA sujets officiels > 2024 > procédures' },
  // 2023
  { url: 'https://www.cnb.avocat.fr/sites/default/files/documents/note_de_synthese_-sujet_principal-examen_dacces_crfpa_2023.pdf', title: 'Sujet CRFPA 2023 — Note de synthèse', slug: 'sujet-2023-note-synthese', breadcrumb: 'CRFPA sujets officiels > 2023 > note de synthèse' },
  { url: 'https://www.cnb.avocat.fr/sites/default/files/documents/droit_des_obligations-_sujet_principal-examen_dacces_crfpa2023.pdf', title: 'Sujet CRFPA 2023 — Droit des obligations', slug: 'sujet-2023-obligations', breadcrumb: 'CRFPA sujets officiels > 2023 > obligations' },
  { url: 'https://www.cnb.avocat.fr/sites/default/files/documents/cas_pratiques-_sujets_principaux-examen_dacces_crfpa_2023.pdf', title: 'Sujet CRFPA 2023 — Cas pratiques', slug: 'sujet-2023-cas-pratiques', breadcrumb: 'CRFPA sujets officiels > 2023 > cas pratiques' },
  { url: 'https://www.cnb.avocat.fr/sites/default/files/documents/procedures-sujets_principaux_ar-_examen_dacces_crfpa_2023-v2.pdf', title: 'Sujet CRFPA 2023 — Procédures', slug: 'sujet-2023-procedures', breadcrumb: 'CRFPA sujets officiels > 2023 > procédures' },
  // 2022
  { url: 'https://www.cnb.avocat.fr/sites/default/files/documents/2022_crfpa_note_de_synthese_sujet_principal.pdf', title: 'Sujet CRFPA 2022 — Note de synthèse', slug: 'sujet-2022-note-synthese', breadcrumb: 'CRFPA sujets officiels > 2022 > note de synthèse' },
  { url: 'https://www.cnb.avocat.fr/sites/default/files/documents/22_cffpa_droit_des_obligations_sujet_principal.pdf', title: 'Sujet CRFPA 2022 — Droit des obligations', slug: 'sujet-2022-obligations', breadcrumb: 'CRFPA sujets officiels > 2022 > obligations' },
  { url: 'https://www.cnb.avocat.fr/sites/default/files/documents/22_crfpa_cas_pratiques_sujets_principaux.pdf', title: 'Sujet CRFPA 2022 — Cas pratiques', slug: 'sujet-2022-cas-pratiques', breadcrumb: 'CRFPA sujets officiels > 2022 > cas pratiques' },
  { url: 'https://www.cnb.avocat.fr/sites/default/files/documents/22_crfpa_procedures_sujets_principaux.pdf', title: 'Sujet CRFPA 2022 — Procédures', slug: 'sujet-2022-procedures', breadcrumb: 'CRFPA sujets officiels > 2022 > procédures' },
  // 2021
  { url: 'https://www.cnb.avocat.fr/sites/default/files/documents/note_de_synthese_-sujet_principal-examen_dacces_crfpa_2021.pdf', title: 'Sujet CRFPA 2021 — Note de synthèse', slug: 'sujet-2021-note-synthese', breadcrumb: 'CRFPA sujets officiels > 2021 > note de synthèse' },
  { url: 'https://www.cnb.avocat.fr/sites/default/files/documents/droit_des_obligations-_sujet_principal-examen_dacces_crfpa2021.pdf', title: 'Sujet CRFPA 2021 — Droit des obligations', slug: 'sujet-2021-obligations', breadcrumb: 'CRFPA sujets officiels > 2021 > obligations' },
  { url: 'https://www.cnb.avocat.fr/sites/default/files/documents/cas_pratiques-_sujets_principaux-examen_dacces_crfpa_2021.pdf', title: 'Sujet CRFPA 2021 — Cas pratiques', slug: 'sujet-2021-cas-pratiques', breadcrumb: 'CRFPA sujets officiels > 2021 > cas pratiques' },
  { url: 'https://www.cnb.avocat.fr/sites/default/files/documents/procedures-sujets_principaux-_examen_dacces_crfpa_2021.pdf', title: 'Sujet CRFPA 2021 — Procédures', slug: 'sujet-2021-procedures', breadcrumb: 'CRFPA sujets officiels > 2021 > procédures' },
  // 2020
  { url: 'https://www.cnb.avocat.fr/sites/default/files/documents/ns_2020.pdf', title: 'Sujet CRFPA 2020 — Note de synthèse', slug: 'sujet-2020-note-synthese', breadcrumb: 'CRFPA sujets officiels > 2020 > note de synthèse' },
  { url: 'https://www.cnb.avocat.fr/sites/default/files/documents/do_2020.pdf', title: 'Sujet CRFPA 2020 — Droit des obligations', slug: 'sujet-2020-obligations', breadcrumb: 'CRFPA sujets officiels > 2020 > obligations' },
  { url: 'https://www.cnb.avocat.fr/sites/default/files/documents/cp_2020.pdf', title: 'Sujet CRFPA 2020 — Cas pratiques', slug: 'sujet-2020-cas-pratiques', breadcrumb: 'CRFPA sujets officiels > 2020 > cas pratiques' },
  { url: 'https://www.cnb.avocat.fr/sites/default/files/documents/proc_2020.pdf', title: 'Sujet CRFPA 2020 — Procédures', slug: 'sujet-2020-procedures', breadcrumb: 'CRFPA sujets officiels > 2020 > procédures' },

  // ─── Grilles de notation 2025 (12 épreuves) ─────────────────────
  // Mirror: Cap'Barreau reproduces official CNB grilles (CNB public docs)
  { url: 'https://capbarreau.com/wp-content/uploads/2026/04/Grille-de-notation-Note-de-synthese-sujet-principal2025.pdf', title: 'Grille de notation CRFPA 2025 — Note de synthèse', slug: 'grille-2025-note-synthese', breadcrumb: 'CRFPA grilles officielles > 2025 > note de synthèse' },
  { url: 'https://capbarreau.com/wp-content/uploads/2026/04/Grille-de-notation-Droit-des-obligations-sujet-principal2025.pdf', title: 'Grille de notation CRFPA 2025 — Droit des obligations', slug: 'grille-2025-obligations', breadcrumb: 'CRFPA grilles officielles > 2025 > obligations' },
  { url: 'https://capbarreau.com/wp-content/uploads/2026/04/Grille-de-notation-Droit-administratif-sujet-principal2025.pdf', title: 'Grille de notation CRFPA 2025 — Droit administratif', slug: 'grille-2025-administratif', breadcrumb: 'CRFPA grilles officielles > 2025 > administratif' },
  { url: 'https://capbarreau.com/wp-content/uploads/2026/04/Grille-de-notation-Droit-civil-sujet-principal2025-vconsolidee.pdf', title: 'Grille de notation CRFPA 2025 — Droit civil', slug: 'grille-2025-civil', breadcrumb: 'CRFPA grilles officielles > 2025 > civil' },
  { url: 'https://capbarreau.com/wp-content/uploads/2026/04/Grille-de-notation-Droit-des-affaires-sujet-principal2025.pdf', title: 'Grille de notation CRFPA 2025 — Droit des affaires', slug: 'grille-2025-affaires', breadcrumb: 'CRFPA grilles officielles > 2025 > affaires' },
  { url: 'https://capbarreau.com/wp-content/uploads/2026/04/Grille-de-notation-Droit-fiscal-sujet-principal2025.pdf', title: 'Grille de notation CRFPA 2025 — Droit fiscal', slug: 'grille-2025-fiscal', breadcrumb: 'CRFPA grilles officielles > 2025 > fiscal' },
  { url: 'https://capbarreau.com/wp-content/uploads/2026/04/Grille-de-notation-Droit-international-et-europeen-sujet-principal2025-vconsolidee.pdf', title: 'Grille de notation CRFPA 2025 — Droit international et européen', slug: 'grille-2025-international', breadcrumb: 'CRFPA grilles officielles > 2025 > international' },
  { url: 'https://capbarreau.com/wp-content/uploads/2026/04/Grille-de-notation-Droit-penal-sujet-principal2025.pdf', title: 'Grille de notation CRFPA 2025 — Droit pénal', slug: 'grille-2025-penal', breadcrumb: 'CRFPA grilles officielles > 2025 > pénal' },
  { url: 'https://capbarreau.com/wp-content/uploads/2026/04/Grille-de-notation-Droit-social-sujet-principal2025.pdf', title: 'Grille de notation CRFPA 2025 — Droit social', slug: 'grille-2025-social', breadcrumb: 'CRFPA grilles officielles > 2025 > social' },
  { url: 'https://capbarreau.com/wp-content/uploads/2026/04/Grille-de-notation-Procedure-civile-et-MARD-sujet-principal2025-vconsolide.pdf', title: 'Grille de notation CRFPA 2025 — Procédure civile et MARD', slug: 'grille-2025-procedure-civile', breadcrumb: 'CRFPA grilles officielles > 2025 > procédure civile' },
  { url: 'https://capbarreau.com/wp-content/uploads/2026/04/Grille-de-notation-Procedure-administrative-et-MARD-sujet-principal2025.pdf', title: 'Grille de notation CRFPA 2025 — Procédure administrative et MARD', slug: 'grille-2025-procedure-admin', breadcrumb: 'CRFPA grilles officielles > 2025 > procédure administrative' },
  { url: 'https://capbarreau.com/wp-content/uploads/2026/04/Grille-de-notation-Procedure-penale-sujet-principal2025.pdf', title: 'Grille de notation CRFPA 2025 — Procédure pénale', slug: 'grille-2025-procedure-penale', breadcrumb: 'CRFPA grilles officielles > 2025 > procédure pénale' },

  // ─── Other CRFPA reference documents ────────────────────────────
  { url: 'https://cnb.avocat.fr/medias/file/rinconsolide-final---maj-10032026-69b3efdd32d1b4.99657001.pdf', title: "Règlement Intérieur National de la profession d'avocat (RIN consolidé mars 2026)", slug: 'rin-2026', breadcrumb: 'CRFPA déontologie > RIN 2026' },
  { url: 'https://www.cnb.avocat.fr/sites/default/files/documents/Commission-Nationale_Documents-pouvant-e%CC%82tre-utilises-2025-pr%C3%A9cision.pdf', title: "Commission Nationale — Documents pouvant être utilisés (CRFPA 2025)", slug: 'documents-autorises-2025', breadcrumb: 'CRFPA officiel > Documents autorisés 2025' },
]

async function downloadPdf(url: string, destPath: string): Promise<boolean> {
  if (existsSync(destPath)) return true
  try {
    execSync(`/usr/bin/curl -sL --max-time 120 -A "corpus-ingest/1.0" -o ${JSON.stringify(destPath)} ${JSON.stringify(url)}`)
    if (!existsSync(destPath)) return false
    const head = execSync(`head -c 8 ${JSON.stringify(destPath)}`, { encoding: 'utf-8' })
    return head.startsWith('%PDF')
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
  console.log(`=== CRFPA official docs ingest (${PDFS.length} PDFs) ===`)
  const pdfDir = join(outputDir, 'cache', 'crfpa-official')
  mkdirSync(pdfDir, { recursive: true })
  mkdirSync(join(outputDir, 'cache'), { recursive: true })
  mkdirSync(join(outputDir, 'chunks'), { recursive: true })

  const all: Chunk[] = []
  let ok = 0, miss = 0
  for (const ref of PDFS) {
    const pdfPath = join(pdfDir, `${ref.slug}.pdf`)
    const downloaded = await downloadPdf(ref.url, pdfPath)
    if (!downloaded) {
      console.log(`✗ ${ref.slug} — download failed`)
      miss++
      continue
    }
    const text = extractPdfText(pdfPath)
    if (!text) {
      console.log(`✗ ${ref.slug} — extract failed`)
      miss++
      continue
    }
    const chunks = chunkText(text, ref)
    all.push(...chunks)
    ok++
    console.log(`✓ ${ref.slug}: ${text.length} chars → ${chunks.length} chunks`)
  }

  const chunksPath = join(outputDir, 'chunks', 'crfpa-official.json')
  const cachePath = join(outputDir, 'cache', 'crfpa-official.json')
  writeFileSync(chunksPath, JSON.stringify(all))
  writeFileSync(cachePath, JSON.stringify(all))
  console.log(`\n=== Done ===`)
  console.log(`PDFs: ${ok} ok, ${miss} failed`)
  console.log(`Total chunks: ${all.length}`)
  console.log(`→ ${chunksPath}`)
}

main().catch((err) => { console.error('Fatal:', err); process.exit(1) })
