#!/usr/bin/env npx tsx
/* eslint-disable no-console */
/**
 * Ingest landmark Conseil constitutionnel decisions (DC + QPC) into the
 * legal-codes Vectorize index. Stage 2 of the jurisprudence expansion
 * (complements Cass. via Judilibre, CEDH via HUDOC, CE via Ariane).
 *
 * Strategy:
 *   - Curated list of ~80 canonical decisions (GAJCC + Grand Oral-relevant)
 *   - Fetch each via the public conseil-constitutionnel.fr HTML page
 *   - Parse <article> block for text, extract considérants
 *   - Chunk decisions longer than MAX_CHARS
 *   - Output to legal-sources-output/cache/conseil-constitutionnel.json
 *   - Merge into all-sources-chunks.json, then run embed-sources.ts
 *
 * Usage:
 *   npx tsx scripts/ingest-conseil-constitutionnel.ts [--output-dir legal-sources-output]
 *   npx tsx scripts/embed-sources.ts --input legal-sources-output/cache/conseil-constitutionnel.json
 *   # then upload the resulting NDJSON via the admin vectorize endpoint
 *
 * No API key required — uses the public CC website.
 * Rate-limited to 1 req/sec to be polite.
 */
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { parseArgs } from 'util'

const { values } = parseArgs({
  options: {
    'output-dir': { type: 'string', default: 'legal-sources-output' },
    force: { type: 'boolean', default: false },
  },
})

const outputDir = values['output-dir'] ?? 'legal-sources-output'
const force = values.force ?? false

const CACHE_DIR = join(outputDir, 'cache', 'conseil-constitutionnel')
const OUTPUT_FILE = join(outputDir, 'cache', 'conseil-constitutionnel.json')
const MAX_CHARS = 3000
const REQ_DELAY_MS = 1100

function sleep(ms: number): Promise<void> { return new Promise(r => setTimeout(r, ms)) }

interface Chunk {
  id: string
  codeName: string
  num: string
  breadcrumb: string
  text: string
}

interface Landmark {
  year: number
  num: string            // "71-44" or "2010-14/22"
  kind: 'DC' | 'QPC' | 'LOM' | 'RIP' | 'L'
  date: string           // "1971-07-16"
  title: string          // short subject
  tags: string[]         // Grand Oral themes
}

// ─── Curated landmark decisions ─────────────────────────
// Each entry triggers a fetch from https://www.conseil-constitutionnel.fr/decision/<year>/<slug>.htm
// Slug format: {num without '-' if < 2008}{DC/QPC/...}.htm (verified empirically)

const LANDMARKS: Landmark[] = [
  // Fondations (pre-QPC era — DC landmarks)
  { year: 1971, num: '71-44',  kind: 'DC',  date: '1971-07-16', title: 'Liberté d\'association', tags: ['liberte-association', 'fondamentaux'] },
  { year: 1973, num: '73-51',  kind: 'DC',  date: '1973-12-27', title: 'Taxation d\'office', tags: ['egalite', 'fiscalite'] },
  { year: 1975, num: '74-54',  kind: 'DC',  date: '1975-01-15', title: 'IVG — loi Veil', tags: ['bioethique', 'ivg'] },
  { year: 1977, num: '76-75',  kind: 'DC',  date: '1977-01-12', title: 'Fouille de véhicules — liberté individuelle', tags: ['procedure-penale', 'liberte-individuelle'] },
  { year: 1981, num: '80-127', kind: 'DC',  date: '1981-01-19-20', title: 'Sécurité et liberté', tags: ['securite-libertes'] },
  { year: 1982, num: '81-132', kind: 'DC',  date: '1982-01-16', title: 'Nationalisations — liberté d\'entreprendre', tags: ['liberte-entreprendre', 'propriete'] },
  { year: 1984, num: '84-181', kind: 'DC',  date: '1984-10-11', title: 'Loi presse — pluralisme', tags: ['expression', 'pluralisme-medias'] },
  { year: 1984, num: '83-165', kind: 'DC',  date: '1984-01-20', title: 'Libertés universitaires', tags: ['expression', 'enseignement'] },
  { year: 1988, num: '88-244', kind: 'DC',  date: '1988-07-20', title: 'Amnistie — égalité', tags: ['egalite'] },
  { year: 1989, num: '88-248', kind: 'DC',  date: '1989-01-17', title: 'CSA — indépendance autorité régulation', tags: ['institutions', 'expression'] },
  { year: 1989, num: '89-261', kind: 'DC',  date: '1989-07-28', title: 'Reconduite à la frontière — juge judiciaire', tags: ['etrangers', 'liberte-individuelle'] },
  { year: 1993, num: '93-325', kind: 'DC',  date: '1993-08-13', title: 'Maîtrise immigration — droit d\'asile', tags: ['etrangers', 'asile'] },
  { year: 1994, num: '94-343-344', kind: 'DC', date: '1994-07-27', title: 'Bioéthique — dignité', tags: ['bioethique', 'dignite'] },
  { year: 1999, num: '99-419', kind: 'DC',  date: '1999-11-09', title: 'PACS — respect vie privée', tags: ['vie-privee'] },
  { year: 2003, num: '2003-467', kind: 'DC', date: '2003-03-13', title: 'Sécurité intérieure — contrôles d\'identité', tags: ['procedure-penale', 'egalite'] },
  { year: 2003, num: '2003-484', kind: 'DC', date: '2003-11-20', title: 'Maîtrise immigration (II)', tags: ['etrangers'] },
  { year: 2004, num: '2004-496', kind: 'DC', date: '2004-06-10', title: 'LCEN — transposition directive', tags: ['numerique', 'expression'] },
  { year: 2004, num: '2004-505', kind: 'DC', date: '2004-11-19', title: 'Traité constitutionnel européen', tags: ['institutions'] },
  { year: 2006, num: '2006-540', kind: 'DC', date: '2006-07-27', title: 'DADVSI — propriété intellectuelle', tags: ['propriete', 'numerique'] },
  { year: 2007, num: '2007-557', kind: 'DC', date: '2007-11-15', title: 'Immigration — tests ADN', tags: ['etrangers', 'dignite'] },
  { year: 2008, num: '2008-562', kind: 'DC', date: '2008-02-21', title: 'Rétention de sûreté — non-rétroactivité', tags: ['procedure-penale', 'liberte-individuelle'] },
  { year: 2008, num: '2008-564', kind: 'DC', date: '2008-06-19', title: 'OGM — Charte environnement', tags: ['environnement'] },

  // QPC ère (depuis 2010)
  { year: 2010, num: '2010-14/22', kind: 'QPC', date: '2010-07-30', title: 'Garde à vue — procès équitable', tags: ['procedure-penale'] },
  { year: 2010, num: '2010-613',   kind: 'DC',  date: '2010-10-07', title: 'Dissimulation du visage', tags: ['laicite', 'liberte-religion'] },
  { year: 2010, num: '2010-71',    kind: 'QPC', date: '2010-11-26', title: 'Hospitalisation sans consentement', tags: ['detention', 'liberte-individuelle'] },
  { year: 2012, num: '2012-240',   kind: 'QPC', date: '2012-05-04', title: 'Harcèlement sexuel — légalité pénale', tags: ['procedure-penale', 'egalite'] },
  { year: 2013, num: '2013-357',   kind: 'QPC', date: '2013-11-29', title: 'Gay marriage — égalité', tags: ['egalite', 'vie-privee'] },
  { year: 2013, num: '2013-669',   kind: 'DC',  date: '2013-05-17', title: 'Mariage pour tous', tags: ['egalite'] },
  { year: 2014, num: '2014-420/421', kind: 'QPC', date: '2014-10-09', title: 'Prolongation garde à vue bande organisée', tags: ['procedure-penale'] },
  { year: 2015, num: '2015-527',   kind: 'QPC', date: '2015-12-22', title: 'Assignation à résidence — état urgence', tags: ['securite-libertes'] },
  { year: 2016, num: '2016-536',   kind: 'QPC', date: '2016-02-19', title: 'Perquisitions administratives état urgence', tags: ['securite-libertes', 'procedure-penale'] },
  { year: 2016, num: '2016-611',   kind: 'QPC', date: '2016-12-10', title: 'Consultation habituelle sites terroristes', tags: ['expression', 'securite-libertes'] },
  { year: 2017, num: '2017-682',   kind: 'QPC', date: '2017-12-15', title: 'Délit consultation sites terro — bis', tags: ['expression'] },
  { year: 2018, num: '2018-717/718', kind: 'QPC', date: '2018-07-06', title: 'Fraternité — délit de solidarité', tags: ['etrangers', 'egalite'] },
  { year: 2018, num: '2018-765',   kind: 'DC',  date: '2018-06-12', title: 'Protection données — RGPD', tags: ['vie-privee', 'numerique'] },
  { year: 2019, num: '2019-780',   kind: 'DC',  date: '2019-04-04', title: 'Anti-casseurs — liberté manifestation', tags: ['expression'] },
  { year: 2020, num: '2020-800',   kind: 'DC',  date: '2020-05-11', title: 'État urgence sanitaire', tags: ['securite-libertes'] },
  { year: 2020, num: '2020-801',   kind: 'DC',  date: '2020-06-18', title: 'Loi Avia — haine en ligne', tags: ['expression', 'numerique'] },
  { year: 2020, num: '2020-843',   kind: 'QPC', date: '2020-05-28', title: 'Charte environnement — principe précaution', tags: ['environnement'] },
  { year: 2020, num: '2020-858/859', kind: 'QPC', date: '2020-10-02', title: 'Conditions détention indignes — recours', tags: ['detention'] },
  { year: 2020, num: '2020-872',   kind: 'QPC', date: '2021-01-15', title: 'Visioconférence procédure pénale', tags: ['procedure-penale'] },
  { year: 2021, num: '2020-878/879', kind: 'QPC', date: '2021-01-29', title: 'Dissolution associations — secret déf. nat.', tags: ['expression'] },
  { year: 2021, num: '2021-817',   kind: 'DC',  date: '2021-05-20', title: 'Sécurité globale — drones', tags: ['vie-privee', 'securite-libertes'] },
  { year: 2021, num: '2021-824',   kind: 'DC',  date: '2021-08-05', title: 'Pass sanitaire', tags: ['securite-libertes'] },
  { year: 2021, num: '2021-927',   kind: 'QPC', date: '2021-09-14', title: 'Rapports procureur général', tags: ['institutions'] },
  { year: 2021, num: '2021-940',   kind: 'QPC', date: '2021-10-15', title: 'Encadrement loyers — liberté entreprendre', tags: ['liberte-entreprendre'] },
  { year: 2022, num: '2021-957',   kind: 'QPC', date: '2022-02-18', title: 'Fichier TES — vie privée', tags: ['vie-privee'] },
  { year: 2022, num: '2022-835',   kind: 'DC',  date: '2022-01-21', title: 'Pass vaccinal', tags: ['securite-libertes'] },
  { year: 2023, num: '2023-1069/1070', kind: 'QPC', date: '2023-11-24', title: 'Cour criminelle départementale', tags: ['procedure-penale'] },
  { year: 2023, num: '2023-1045', kind: 'QPC', date: '2023-04-21', title: 'Rétention administrative étrangers', tags: ['etrangers', 'detention'] },
  { year: 2023, num: '2023-853',  kind: 'DC',  date: '2023-01-19', title: 'Retraites — loi rectificative', tags: ['droits-sociaux', 'institutions'] },
  { year: 2024, num: '2023-1110', kind: 'QPC', date: '2024-01-25', title: 'Droit au silence fonctionnaires', tags: ['procedure-penale'] },
  { year: 2024, num: '2024-1089', kind: 'QPC', date: '2024-10-31', title: 'Transcription actes GPA étranger', tags: ['bioethique'] },
]

// ─── Fetching ───────────────────────────────────────────

function decisionUrl(l: Landmark): string {
  // All eras: slug = num with dashes and "/second part" stripped, then {DC|QPC}.htm
  // Pre-2008:  "71-44"        → "7144DC.htm"
  // 2008+:     "2010-613"     → "2010613DC.htm"
  // Composite: "2010-14/22"   → "201014QPC.htm"  (first number only)
  const numPart = l.num.split('/')[0].replace(/-/g, '')
  return `https://www.conseil-constitutionnel.fr/decision/${l.year}/${numPart}${l.kind}.htm`
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(Number(c)))
    .replace(/&[a-z]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractMainContent(html: string): string {
  // CC pages wrap the decision in <main> or <article>. Grab either.
  const mainMatch = html.match(/<main[\s\S]*?<\/main>/i)
  const articleMatch = html.match(/<article[\s\S]*?<\/article>/i)
  const candidate = mainMatch?.[0] ?? articleMatch?.[0] ?? html
  return stripHtml(candidate)
}

async function fetchDecision(l: Landmark): Promise<string | null> {
  const url = decisionUrl(l)
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; studykit-crfpa-ingest/1.0)' },
    })
    if (!res.ok) {
      console.error(`  [${res.status}] ${url}`)
      return null
    }
    const html = await res.text()
    const text = extractMainContent(html)
    if (text.length < 500) {
      console.error(`  [short] ${url} (${text.length} chars)`)
      return null
    }
    return text
  } catch (err) {
    console.error(`  [fetch error] ${url}: ${(err as Error).message}`)
    return null
  }
}

function chunkText(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text]
  const chunks: string[] = []
  // Prefer splitting on "Considérant" boundaries
  const parts = text.split(/(?=\b(?:Considérant|Article \d|Décide|Sur|Le Conseil constitutionnel))/i)
  let buf = ''
  for (const p of parts) {
    if ((buf + p).length > maxChars && buf) {
      chunks.push(buf.trim())
      buf = p
    } else {
      buf += p
    }
  }
  if (buf.trim()) chunks.push(buf.trim())
  // Fallback: character slicing
  if (chunks.length === 1 && chunks[0].length > maxChars) {
    return Array.from({ length: Math.ceil(text.length / maxChars) }, (_, i) =>
      text.slice(i * maxChars, (i + 1) * maxChars))
  }
  return chunks
}

function landmarkToChunks(l: Landmark, text: string): Chunk[] {
  const pieces = chunkText(text, MAX_CHARS)
  const safeNum = l.num.replace(/\//g, '-')
  return pieces.map((piece, i) => ({
    id: `cc-${l.year}-${safeNum}-${l.kind}${pieces.length > 1 ? `-p${i}` : ''}`.slice(0, 60),
    codeName: `Conseil constitutionnel — ${l.kind}`,
    num: l.num,
    breadcrumb: `Conseil constitutionnel > Décision n° ${l.num} ${l.kind} du ${l.date} — ${l.title}`,
    text: `Décision n° ${l.num} ${l.kind} du ${l.date}\nObjet : ${l.title}\nThèmes : ${l.tags.join(', ')}${pieces.length > 1 ? ` (partie ${i + 1}/${pieces.length})` : ''}\n\n${piece}`,
  }))
}

// ─── Main ───────────────────────────────────────────────

async function main(): Promise<void> {
  mkdirSync(CACHE_DIR, { recursive: true })

  if (existsSync(OUTPUT_FILE) && !force) {
    const existing = JSON.parse(readFileSync(OUTPUT_FILE, 'utf-8')) as Chunk[]
    console.log(`Output already exists with ${existing.length} chunks. Pass --force to re-ingest.`)
    return
  }

  console.log(`=== Ingest Conseil constitutionnel — ${LANDMARKS.length} landmark decisions ===\n`)
  const allChunks: Chunk[] = []
  let fetched = 0
  let failed = 0

  for (const l of LANDMARKS) {
    const perDecCache = join(CACHE_DIR, `${l.year}-${l.num.replace(/\//g, '-')}-${l.kind}.html`)
    let text: string | null = null

    if (existsSync(perDecCache)) {
      const html = readFileSync(perDecCache, 'utf-8')
      text = extractMainContent(html)
    } else {
      process.stdout.write(`  ${l.year} n° ${l.num} ${l.kind} — ${l.title}... `)
      text = await fetchDecision(l)
      if (text) {
        writeFileSync(perDecCache, text)
        fetched++
        console.log('ok')
      } else {
        failed++
        console.log('FAIL')
      }
      await sleep(REQ_DELAY_MS)
    }

    if (text) {
      allChunks.push(...landmarkToChunks(l, text))
    }
  }

  writeFileSync(OUTPUT_FILE, JSON.stringify(allChunks, null, 2))
  console.log(`\n=== Done ===`)
  console.log(`  Landmarks:  ${LANDMARKS.length}`)
  console.log(`  Fetched:    ${fetched}`)
  console.log(`  Failed:     ${failed}`)
  console.log(`  Chunks:     ${allChunks.length}`)
  console.log(`  Output:     ${OUTPUT_FILE}`)
  console.log(`\nNext: npx tsx scripts/embed-sources.ts --input ${OUTPUT_FILE}`)
}

main().catch(err => { console.error(err); process.exit(1) })
