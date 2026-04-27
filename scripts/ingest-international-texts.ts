#!/usr/bin/env npx tsx
/* eslint-disable no-console */
/**
 * Ingest major international texts referenced in CRFPA courses:
 *   - Convention européenne des droits de l'homme (CEDH)
 *   - Traité sur l'Union européenne (TUE)
 *   - Traité sur le fonctionnement de l'UE (TFUE)
 *   - Charte des droits fondamentaux de l'UE
 *
 * Source: Wikipédia FR (CC-BY-SA, attribution preserved) — the official
 * EUR-Lex consolidated pages return 202s to scripted clients, and Legifrance
 * only stores the ratification decrees, not the treaty bodies themselves.
 * Wikipedia carries the full articles verbatim with proper structure.
 *
 * Usage:
 *   npx tsx scripts/ingest-international-texts.ts
 */

import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { parseArgs } from 'util'
import { sleep, type Chunk } from './lib/legifranceClient'

const { values } = parseArgs({
  options: {
    'output-dir': { type: 'string', default: 'legal-sources-output' },
    'piste-client-id': { type: 'string' },
    'piste-client-secret': { type: 'string' },
  },
})

const outputDir = values['output-dir']!

// ─── Sources (Wikipedia FR) ────────────────────────────

interface TextRef { wikiSlug: string; title: string; slug: string }

const TEXTS: TextRef[] = [
  {
    wikiSlug: 'Convention_européenne_des_droits_de_l%27homme',
    title: "Convention européenne des droits de l'homme (CEDH)",
    slug: 'cedh-convention',
  },
  {
    wikiSlug: 'Traité_sur_l%27Union_européenne',
    title: "Traité sur l'Union européenne (TUE)",
    slug: 'tue',
  },
  {
    wikiSlug: 'Traité_sur_le_fonctionnement_de_l%27Union_européenne',
    title: "Traité sur le fonctionnement de l'Union européenne (TFUE)",
    slug: 'tfue',
  },
  {
    wikiSlug: 'Charte_des_droits_fondamentaux_de_l%27Union_européenne',
    title: "Charte des droits fondamentaux de l'Union européenne",
    slug: 'charte-ue',
  },
  {
    wikiSlug: 'Règlement_intérieur_national_de_la_profession_d%27avocat',
    title: "Règlement Intérieur National de la profession d'avocat (RIN)",
    slug: 'rin-avocat',
  },
  {
    wikiSlug: 'Déclaration_universelle_des_droits_de_l%27homme',
    title: "Déclaration universelle des droits de l'homme (DUDH 1948)",
    slug: 'dudh-1948',
  },
  // CEDH Protocols additionnels (libertés fondamentales — Grand Oral)
  {
    wikiSlug: 'Protocole_no_1_à_la_Convention_européenne_des_droits_de_l%27homme',
    title: 'Protocole additionnel n° 1 à la CEDH (propriété, instruction, élections)',
    slug: 'cedh-protocole-1',
  },
  {
    wikiSlug: 'Protocole_no_4_à_la_Convention_européenne_des_droits_de_l%27homme',
    title: 'Protocole n° 4 à la CEDH (liberté de circulation, interdiction expulsions collectives)',
    slug: 'cedh-protocole-4',
  },
  {
    wikiSlug: 'Protocole_no_6_à_la_Convention_européenne_des_droits_de_l%27homme',
    title: 'Protocole n° 6 à la CEDH (abolition peine de mort)',
    slug: 'cedh-protocole-6',
  },
  {
    wikiSlug: 'Protocole_no_7_à_la_Convention_européenne_des_droits_de_l%27homme',
    title: 'Protocole n° 7 à la CEDH (double degré de juridiction, ne bis in idem)',
    slug: 'cedh-protocole-7',
  },
  {
    wikiSlug: 'Protocole_no_12_à_la_Convention_européenne_des_droits_de_l%27homme',
    title: 'Protocole n° 12 à la CEDH (interdiction générale de discrimination)',
    slug: 'cedh-protocole-12',
  },
  {
    wikiSlug: 'Protocole_no_13_à_la_Convention_européenne_des_droits_de_l%27homme',
    title: 'Protocole n° 13 à la CEDH (abolition peine de mort en toutes circonstances)',
    slug: 'cedh-protocole-13',
  },
]

async function fetchWikipediaText(slug: string): Promise<string | null> {
  const url = `https://fr.wikipedia.org/w/api.php?action=query&format=json&titles=${slug}&prop=extracts&explaintext=1&exsectionformat=plain&redirects=1`
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'corpus-ingest/1.0 (study)' } })
    if (!r.ok) return null
    const j = (await r.json()) as { query?: { pages?: Record<string, { extract?: string }> } }
    const pages = j.query?.pages ?? {}
    for (const p of Object.values(pages)) {
      const t = p.extract?.trim()
      if (t && t.length > 500) return t
    }
    return null
  } catch {
    return null
  }
}

function chunkPlainText(text: string, title: string, slug: string): Chunk[] {
  const MAX = 2000
  const OVERLAP = 200
  const chunks: Chunk[] = []
  if (text.length <= MAX) {
    chunks.push({ id: `${slug}-p0`, codeName: title, num: slug, breadcrumb: title, text })
    return chunks
  }
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

async function ingestText(ref: TextRef): Promise<Chunk[]> {
  console.log(`\n== ${ref.title} ==`)
  const text = await fetchWikipediaText(ref.wikiSlug)
  if (!text) {
    console.log(`  ⚠ Wikipedia fetch miss`)
    return []
  }
  console.log(`  text ${text.length}b`)
  const attributedTitle = `${ref.title} (source Wikipédia CC-BY-SA)`
  const chunks = chunkPlainText(text, attributedTitle, ref.slug)
  console.log(`  → ${chunks.length} chunks`)
  return chunks
}

async function main() {
  console.log('=== International texts ingestion (Wikipedia FR) ===')
  mkdirSync(join(outputDir, 'cache'), { recursive: true })
  mkdirSync(join(outputDir, 'chunks'), { recursive: true })

  const all: Chunk[] = []
  for (const t of TEXTS) {
    try {
      all.push(...(await ingestText(t)))
    } catch (e) {
      console.error(`${t.slug} failed: ${(e as Error).message}`)
    }
    await sleep(500)
  }

  const chunksPath = join(outputDir, 'chunks', 'international-texts.json')
  const cachePath = join(outputDir, 'cache', 'international-texts.json')
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
