#!/usr/bin/env npx tsx
/* eslint-disable no-console */
/**
 * Ingest Conseil constitutionnel decisions from the DILA bulk XML dump.
 *
 * Prerequisites — download + extract the archive (12MB, ~7k XMLs):
 *   mkdir -p legal-sources-output/cache/constit-bulk
 *   cd legal-sources-output/cache/constit-bulk
 *   curl -L -O "https://echanges.dila.gouv.fr/OPENDATA/CONSTIT/Freemium_constit_global_20250713-140000.tar.gz"
 *   tar xzf Freemium_constit_global_20250713-140000.tar.gz
 *
 * Walks the extracted tree, parses each CONSTEXT*.xml, filters to actual
 * jurisprudence (DC / QPC / LOM / LP / AR / etc — ignores non-decision types),
 * chunks on considérant boundaries, writes a chunks JSON for embed-sources.ts.
 *
 * Usage:
 *   npx tsx scripts/ingest-constit-bulk.ts
 *   npx tsx scripts/embed-sources.ts --input legal-sources-output/cache/constit-full.json --output-prefix constit-full
 */
import { writeFileSync, readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const BULK_ROOT = 'legal-sources-output/cache/constit-bulk/constit/global/CONS/TEXT'
const OUTPUT = 'legal-sources-output/cache/constit-full.json'
const MAX_CHARS_PER_CHUNK = 3000

interface Chunk {
  id: string
  codeName: string
  num: string
  breadcrumb: string
  text: string
}

// Decision types we keep. Skip procedural/administrative types with no legal content.
const KEPT_NATURES = new Set([
  'DC',       // contrôle a priori
  'QPC',      // question prioritaire de constitutionnalité
  'LOM',      // loi organique / mode scrutin Polynésie
  'LP',       // loi du pays (Polynésie/Nouvelle-Calédonie)
  'AR',       // référendum / contentieux électoral
  'AN',       // contentieux législatives
  'SEN',      // contentieux sénatoriales
  'PDR',      // contentieux présidentielle
  'REF',      // contrôle d'opérations de référendum
  'ORGA',     // organisation du CC
  'D',        // déclaration (rare)
])

// ─── Parsing ────────────────────────────────────────────

function walkXmls(root: string): string[] {
  const out: string[] = []
  function recurse(dir: string): void {
    let entries: string[]
    try { entries = readdirSync(dir) } catch { return }
    for (const e of entries) {
      const full = join(dir, e)
      const st = statSync(full)
      if (st.isDirectory()) recurse(full)
      else if (e.startsWith('CONSTEXT') && e.endsWith('.xml')) out.push(full)
    }
  }
  recurse(root)
  return out
}

function extract(text: string, tag: string): string | null {
  const rx = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i')
  const m = rx.exec(text)
  return m ? m[1] : null
}

function decodeEntities(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')  // strip remaining tags
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => { try { return String.fromCodePoint(parseInt(h, 16)) } catch { return ' ' } })
    .replace(/&#(\d+);/g, (_, n) => { try { return String.fromCodePoint(parseInt(n, 10)) } catch { return ' ' } })
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

interface Decision {
  id: string
  nature: string
  numero: string
  date: string
  titre: string
  solution: string
  ecli: string
  contenu: string
}

function parseXml(path: string): Decision | null {
  let raw: string
  try { raw = readFileSync(path, 'utf-8') } catch { return null }

  const id = extract(raw, 'ID') ?? ''
  const nature = (extract(raw, 'NATURE') ?? '').trim()
  if (!KEPT_NATURES.has(nature)) return null

  const numero = (extract(raw, 'NUMERO') ?? '').trim()
  const date = (extract(raw, 'DATE_DEC') ?? '').trim()
  const titre = decodeEntities(extract(raw, 'TITRE') ?? '')
  const solution = decodeEntities(extract(raw, 'SOLUTION') ?? '')
  const ecli = (extract(raw, 'ECLI') ?? '').trim()

  // Main text is under TEXTE > BLOC_TEXTUEL > CONTENU. There can be multiple BLOC_TEXTUEL
  // sibling elements; we concatenate them. SAISINES + OBSERVATIONS are skipped (auxiliary).
  const texteBlock = extract(raw, 'BLOC_TEXTUEL')
  if (!texteBlock) return null
  const contenu = decodeEntities(extract(texteBlock, 'CONTENU') ?? '')
  if (contenu.length < 100) return null

  return { id, nature, numero, date, titre, solution, ecli, contenu }
}

// ─── Chunking ───────────────────────────────────────────

function chunkDecision(d: Decision): Chunk[] {
  // Split on considérant boundaries when possible for natural paragraph-level chunks.
  const parts: string[] = []
  const splitRx = /(?=\b(?:Considérant|Article \d|Sur|Décide|Le Conseil constitutionnel))/g
  const remaining = d.contenu
  const segments = remaining.split(splitRx).filter(s => s.trim().length > 0)

  let buf = ''
  for (const seg of segments) {
    if ((buf + seg).length > MAX_CHARS_PER_CHUNK && buf) {
      parts.push(buf.trim())
      buf = seg
    } else {
      buf += seg
    }
  }
  if (buf.trim()) parts.push(buf.trim())

  // Fallback: character slice if nothing split
  if (parts.length === 1 && parts[0].length > MAX_CHARS_PER_CHUNK) {
    parts.length = 0
    for (let i = 0; i < d.contenu.length; i += MAX_CHARS_PER_CHUNK) {
      parts.push(d.contenu.slice(i, i + MAX_CHARS_PER_CHUNK))
    }
  }

  const total = parts.length
  const shortId = d.id.replace(/^CONSTEXT/, 'cc-').slice(0, 50)
  const header = `Décision n° ${d.numero} ${d.nature} du ${d.date} — ${d.titre}\nSolution : ${d.solution}${d.ecli ? `\nECLI : ${d.ecli}` : ''}`

  return parts.map((text, i) => ({
    id: `${shortId}${total > 1 ? `-p${i}` : ''}`.slice(0, 60),
    codeName: `Conseil constitutionnel — ${d.nature}`,
    num: d.numero,
    breadcrumb: `Conseil constitutionnel > ${d.nature} > ${d.date} > n° ${d.numero}${d.titre ? ` — ${d.titre.slice(0, 120)}` : ''}`,
    text: total > 1 ? `${header} (partie ${i + 1}/${total})\n\n${text}` : `${header}\n\n${text}`,
  }))
}

// ─── Main ───────────────────────────────────────────────

function main(): void {
  console.log('=== ingest-constit-bulk ===')
  console.log(`  walking: ${BULK_ROOT}`)
  const xmls = walkXmls(BULK_ROOT)
  console.log(`  found: ${xmls.length} XML files`)

  const byNature: Record<string, number> = {}
  const allChunks: Chunk[] = []
  let skipped = 0

  for (const path of xmls) {
    const d = parseXml(path)
    if (!d) { skipped++; continue }
    byNature[d.nature] = (byNature[d.nature] ?? 0) + 1
    allChunks.push(...chunkDecision(d))
  }

  console.log(`  parsed: ${xmls.length - skipped} decisions, ${skipped} skipped`)
  console.log(`  by nature:`)
  for (const [n, c] of Object.entries(byNature).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${n.padEnd(8)} ${c}`)
  }
  console.log(`  chunks: ${allChunks.length}`)
  console.log(`  avg chunks/decision: ${(allChunks.length / (xmls.length - skipped)).toFixed(1)}`)

  writeFileSync(OUTPUT, JSON.stringify(allChunks))
  console.log(`  wrote: ${OUTPUT}`)
  console.log(`\nNext: npx tsx scripts/embed-sources.ts --input ${OUTPUT} --output-prefix constit-full`)
}

main()
