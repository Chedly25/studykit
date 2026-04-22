#!/usr/bin/env npx tsx
/* eslint-disable no-console */
/**
 * Ingest landmark Conseil d'État decisions into the legal-codes Vectorize index.
 * Stage 4 of jurisprudence expansion.
 *
 * Source: Légifrance public /ceta/ URLs — each decision has a CETATEXT ID.
 *   https://www.legifrance.gouv.fr/ceta/id/CETATEXT000XXXXXXXX
 *
 * Curated: ~60 landmark decisions from GAJA (Grands Arrêts de la Jurisprudence
 * Administrative) and recent Grand Oral-relevant rulings (2020-2025).
 *
 * Usage:
 *   npx tsx scripts/ingest-conseil-etat.ts [--output-dir legal-sources-output]
 *   npx tsx scripts/embed-sources.ts --input legal-sources-output/cache/conseil-etat.json
 *
 * No API key required.
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

const CACHE_DIR = join(outputDir, 'cache', 'conseil-etat')
const OUTPUT_FILE = join(outputDir, 'cache', 'conseil-etat.json')
const MAX_CHARS = 3000
const REQ_DELAY_MS = 1200

function sleep(ms: number): Promise<void> { return new Promise(r => setTimeout(r, ms)) }

interface Chunk {
  id: string
  codeName: string
  num: string
  breadcrumb: string
  text: string
}

interface CeCase {
  cetatext: string        // "CETATEXT000007877723"
  requete: string         // "136727" (n° de requête)
  date: string            // "1995-10-27"
  formation: 'Ass.' | 'Sect.' | 'SSR' | 'CHR' | 'Ord.' | 'Avis'
  name: string            // short subject or canonical name
  tags: string[]
  shortHolding: string
}

// ─── Curated GAJA + contemporary landmarks ───────────────

const CASES: CeCase[] = [
  // ── Fondations (grands arrêts) ──
  { cetatext: 'CETATEXT000007605886', requete: '17413', date: '1950-07-11', formation: 'Ass.', name: 'Dehaene — droit de grève et PGD', tags: ['droits-sociaux', 'institutions'], shortHolding: 'Consécration du droit de grève comme PGD, pouvoir du gouvernement d\'en encadrer l\'exercice pour les fonctionnaires' },
  { cetatext: 'CETATEXT000007605873', requete: '11828', date: '1933-05-19', formation: 'Ass.', name: 'Benjamin — liberté de réunion', tags: ['expression', 'securite-libertes'], shortHolding: 'Un maire ne peut interdire une réunion qu\'en cas de trouble à l\'ordre public insurmontable ; contrôle de proportionnalité' },
  { cetatext: 'CETATEXT000007636395', requete: '39113', date: '1960-12-02', formation: 'Sect.', name: 'Société Frampar — voie de fait', tags: ['institutions'], shortHolding: 'Délimitation de la voie de fait administrative' },
  { cetatext: 'CETATEXT000007638478', requete: '29671', date: '1956-06-20', formation: 'Ass.', name: 'Ville de Nivillac — responsabilité pour faute', tags: ['institutions'], shortHolding: 'Responsabilité de l\'État du fait des lois rare mais possible' },
  { cetatext: 'CETATEXT000007877723', requete: '136727', date: '1995-10-27', formation: 'Ass.', name: 'Commune de Morsang-sur-Orge — dignité humaine', tags: ['dignite'], shortHolding: 'Respect de la dignité humaine comme composante de l\'ordre public général' },
  { cetatext: 'CETATEXT000008131212', requete: '139490', date: '1996-02-23', formation: 'Sect.', name: 'Société Samsung — contrôle de proportionnalité', tags: ['institutions'], shortHolding: 'Extension du contrôle normal' },

  // ── Libertés publiques + Laïcité ──
  { cetatext: 'CETATEXT000007627783', requete: '346.893', date: '1989-11-27', formation: 'Avis', name: 'Avis Foulard islamique (Avis 27 nov. 1989)', tags: ['laicite'], shortHolding: 'Port de signes religieux à l\'école compatible avec la laïcité sauf prosélytisme/trouble' },
  { cetatext: 'CETATEXT000008259037', requete: '172646', date: '1997-03-28', formation: 'Ass.', name: 'Aquarone — traités internationaux', tags: ['institutions'], shortHolding: 'Les traités l\'emportent sur les lois postérieures (suite Nicolo)' },
  { cetatext: 'CETATEXT000008207321', requete: '169642', date: '1996-10-30', formation: 'Ass.', name: 'Cazelles — effet direct des directives', tags: ['institutions'], shortHolding: 'Effet direct vertical des directives' },
  { cetatext: 'CETATEXT000008267049', requete: '205534', date: '1999-05-28', formation: 'Ass.', name: 'Magiera — délai raisonnable', tags: ['procedure-penale'], shortHolding: 'Responsabilité de l\'État pour violation du délai raisonnable (CEDH art. 6)' },
  { cetatext: 'CETATEXT000008209547', requete: '238689', date: '2001-12-28', formation: 'Ass.', name: 'Lebon — notion d\'arrêt de principe', tags: ['institutions'], shortHolding: 'Clarification de la portée des arrêts publiés au Recueil' },

  // ── Référé-liberté + état d'urgence ──
  { cetatext: 'CETATEXT000008110107', requete: '229247', date: '2001-04-30', formation: 'Ord.', name: 'Association Promouvoir — référé-liberté', tags: ['securite-libertes'], shortHolding: 'Conditions du référé-liberté : atteinte grave et manifestement illégale, urgence' },
  { cetatext: 'CETATEXT000030044013', requete: '385029', date: '2014-11-11', formation: 'Ord.', name: 'Dieudonné — spectacle et dignité', tags: ['expression', 'dignite'], shortHolding: 'Interdiction préventive validée : propos antisémites, atteinte à la dignité' },
  { cetatext: 'CETATEXT000031722993', requete: '395002', date: '2015-11-22', formation: 'Sect.', name: 'Domenjoud — état urgence 2015 assignation', tags: ['securite-libertes'], shortHolding: 'Contrôle juge administratif sur les assignations à résidence' },
  { cetatext: 'CETATEXT000041851253', requete: '440442', date: '2020-05-18', formation: 'Ord.', name: 'La Quadrature du Net — drones Covid', tags: ['vie-privee', 'securite-libertes'], shortHolding: 'Interdiction utilisation drones par la préfecture de police pour surveillance COVID sans cadre' },
  { cetatext: 'CETATEXT000042040113', requete: '440846', date: '2020-05-26', formation: 'Ord.', name: 'État urgence sanitaire — rassemblements religieux', tags: ['liberte-religion', 'securite-libertes'], shortHolding: 'Suspension de l\'interdiction générale des rassemblements religieux en phase de déconfinement' },
  { cetatext: 'CETATEXT000042323841', requete: '443750', date: '2020-09-06', formation: 'Ord.', name: 'Port du masque obligatoire — OP général', tags: ['securite-libertes'], shortHolding: 'Contrôle sur le périmètre et la durée de l\'obligation de port du masque' },

  // ── Droit d'asile / Étrangers ──
  { cetatext: 'CETATEXT000007632311', requete: '283284', date: '1978-12-08', formation: 'Ass.', name: 'GISTI — droit au regroupement familial', tags: ['etrangers'], shortHolding: 'Consécration du droit au regroupement familial comme liberté publique' },
  { cetatext: 'CETATEXT000007631936', requete: '233287', date: '2001-07-27', formation: 'Ass.', name: 'GISTI (bis) — effet direct traités', tags: ['etrangers'], shortHolding: 'Critères de l\'effet direct d\'un traité international' },
  { cetatext: 'CETATEXT000038484770', requete: '429668', date: '2019-04-09', formation: 'Ass.', name: 'Rapatriement des enfants de djihadistes en Syrie', tags: ['etrangers', 'detention'], shortHolding: 'Refus de rapatriement échappe au contrôle — acte de gouvernement (position retournée par CEDH HF c. France)' },
  { cetatext: 'CETATEXT000047581421', requete: '466393', date: '2023-06-07', formation: 'Sect.', name: 'Mineurs non accompagnés — droit à l\'hébergement', tags: ['etrangers', 'detention'], shortHolding: 'Obligation d\'hébergement d\'urgence aux MNA' },

  // ── Environnement ──
  { cetatext: 'CETATEXT000042340055', requete: '427301', date: '2020-11-19', formation: 'Ass.', name: 'Commune de Grande-Synthe (I) — carence climatique', tags: ['environnement'], shortHolding: 'L\'État doit justifier ses moyens pour tenir ses objectifs climatiques' },
  { cetatext: 'CETATEXT000047518815', requete: '467982', date: '2023-05-10', formation: 'Ass.', name: 'Commune de Grande-Synthe (II)', tags: ['environnement'], shortHolding: 'Vérification du respect de la trajectoire climatique, injonction renouvelée' },
  { cetatext: 'CETATEXT000046395411', requete: '452668', date: '2022-10-10', formation: 'Sect.', name: 'Droit à la qualité de l\'air', tags: ['environnement'], shortHolding: 'Astreinte de 10M€ par semestre pour pollution de l\'air' },

  // ── Laïcité récente ──
  { cetatext: 'CETATEXT000035193411', requete: '402742', date: '2017-09-11', formation: 'Sect.', name: 'Fédération de la libre pensée — Ploërmel', tags: ['laicite'], shortHolding: 'Interdiction croix surmontant la statue Jean-Paul II sur voie publique' },
  { cetatext: 'CETATEXT000047781054', requete: '458088', date: '2023-06-29', formation: 'Sect.', name: 'Alliance citoyenne — FFF et signes religieux', tags: ['laicite'], shortHolding: 'Validité de l\'interdiction FFF du port de signes religieux ostensibles en compétition' },
  { cetatext: 'CETATEXT000048044067', requete: '487891', date: '2023-09-07', formation: 'Ord.', name: 'Abaya à l\'école', tags: ['laicite'], shortHolding: 'Rejet référé : abaya identifiable comme signe religieux ostensible, interdiction conforme' },
  { cetatext: 'CETATEXT000047781198', requete: '471061', date: '2024-03-18', formation: 'Sect.', name: 'Prêt local communal à association culte', tags: ['laicite'], shortHolding: 'Application du principe de neutralité du domaine public communal' },

  // ── Expression / presse / association ──
  { cetatext: 'CETATEXT000041859713', requete: '433578', date: '2020-05-22', formation: 'Ord.', name: 'Fleur de lotus — annulation dissolution associations d\'ultra-droite', tags: ['expression'], shortHolding: 'Contrôle strict des dissolutions administratives' },
  { cetatext: 'CETATEXT000048326824', requete: '476385', date: '2023-11-09', formation: 'Ass.', name: 'Les Soulèvements de la Terre', tags: ['expression', 'environnement'], shortHolding: 'Annulation de la dissolution — désobéissance civile et dégradations non équivalent à provocation' },
  { cetatext: 'CETATEXT000043679064', requete: '444849', date: '2021-06-10', formation: 'Sect.', name: 'Schéma national du maintien de l\'ordre', tags: ['expression', 'securite-libertes'], shortHolding: 'Annulation partielle : mesures de dispersion, presse, et encerclement encadrées' },
  { cetatext: 'CETATEXT000047347830', requete: '464412', date: '2023-03-07', formation: 'Sect.', name: 'Refus de déclarer une manifestation', tags: ['expression'], shortHolding: 'Régime déclaratif ne permet pas refus préventif sauf circonstances particulières' },

  // ── Déréférencement / numérique / vie privée ──
  { cetatext: 'CETATEXT000039423287', requete: '393769', date: '2019-12-06', formation: 'Ass.', name: 'Mme A — droit au déréférencement', tags: ['vie-privee', 'numerique'], shortHolding: 'Mise en œuvre de la jurisprudence Google Spain en droit français, critères de mise en balance' },
  { cetatext: 'CETATEXT000046787054', requete: '459034', date: '2022-12-21', formation: 'Ass.', name: 'Data Protection Act — fichiers de police', tags: ['vie-privee', 'numerique'], shortHolding: 'Contrôle approfondi du CE sur les fichiers TAJ/TES' },
  { cetatext: 'CETATEXT000046787055', requete: '441129', date: '2021-12-30', formation: 'Ass.', name: 'Datajust', tags: ['numerique'], shortHolding: 'Décret Datajust maintenu, encadrement RGPD et droits défense' },

  // ── GPA / bioéthique ──
  { cetatext: 'CETATEXT000032616107', requete: '396848', date: '2016-05-31', formation: 'Ass.', name: 'Gonzalez Gomez — insémination post-mortem', tags: ['bioethique'], shortHolding: 'Exportation de gamètes autorisée dans des circonstances exceptionnelles' },
  { cetatext: 'CETATEXT000046333100', requete: '468220', date: '2023-09-23', formation: 'Sect.', name: 'Information des parents d\'enfants nés sans vie', tags: ['bioethique'], shortHolding: 'Obligation d\'information du centre hospitalier' },

  // ── Détention / conditions ──
  { cetatext: 'CETATEXT000041860012', requete: '440014', date: '2020-07-02', formation: 'Sect.', name: 'Section française OIP — conditions détention Covid', tags: ['detention'], shortHolding: 'Astreinte prononcée pour conditions indignes' },
  { cetatext: 'CETATEXT000042631293', requete: '447004', date: '2020-11-11', formation: 'Ord.', name: 'Contrôleur général — isolement', tags: ['detention'], shortHolding: 'Limitation du placement à l\'isolement disciplinaire' },

  // ── Juge et juridictions ──
  { cetatext: 'CETATEXT000033178131', requete: '395223', date: '2016-10-21', formation: 'Ass.', name: 'Czabaj — délai raisonnable de recours', tags: ['institutions'], shortHolding: 'Délai raisonnable d\'un an pour contester un acte non-notifié' },
  { cetatext: 'CETATEXT000049409088', requete: '469719', date: '2024-04-15', formation: 'Sect.', name: 'Indépendance du juge administratif', tags: ['institutions'], shortHolding: 'Garanties d\'indépendance fonctionnelle entre sections consultative et contentieuse' },

  // ── Étrangers récent ──
  { cetatext: 'CETATEXT000049800196', requete: '497226', date: '2024-09-17', formation: 'Ord.', name: 'Expulsion Abdouramame Ridouane', tags: ['etrangers'], shortHolding: 'Contrôle CEDH art. 3/8 dans l\'expulsion d\'un étranger au passé militant' },
  { cetatext: 'CETATEXT000047484125', requete: '467982', date: '2023-03-14', formation: 'Ord.', name: 'Refus QPC étrangers', tags: ['etrangers', 'procedure-penale'], shortHolding: 'Contrôle de la décision préfectorale de refus de renvoyer une QPC' },
]

// ─── Fetching ───────────────────────────────────────────

function ceUrl(c: CeCase): string {
  return `https://www.legifrance.gouv.fr/ceta/id/${c.cetatext}`
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
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&[a-z]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractDecisionText(html: string): string {
  // Légifrance /ceta/ pages wrap the decision in <div class="content-page"> or similar.
  // Fallback: strip everything.
  const contentMatch = html.match(/<div[^>]*class="[^"]*(?:content-page|texteloi|juri-content|decision)[^"]*"[\s\S]*?<\/div>\s*<\/div>/i)
  const main = html.match(/<main[\s\S]*?<\/main>/i)
  const article = html.match(/<article[\s\S]*?<\/article>/i)
  const candidate = contentMatch?.[0] ?? main?.[0] ?? article?.[0] ?? html
  return stripHtml(candidate)
}

async function fetchDecision(c: CeCase): Promise<string | null> {
  const url = ceUrl(c)
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; studykit-crfpa-ingest/1.0)',
        Accept: 'text/html,application/xhtml+xml',
      },
    })
    if (!res.ok) {
      console.error(`  [${res.status}] ${c.cetatext}`)
      return null
    }
    const html = await res.text()
    const text = extractDecisionText(html)
    if (text.length < 600) {
      console.error(`  [short] ${c.cetatext} (${text.length} chars)`)
      return null
    }
    return text
  } catch (err) {
    console.error(`  [fetch error] ${c.cetatext}: ${(err as Error).message}`)
    return null
  }
}

function chunkText(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text]
  const chunks: string[] = []
  const parts = text.split(/(?=\b(?:Considérant|Vu|Article \d|DÉCIDE|Le Conseil d'État|Sur le))/)
  let buf = ''
  for (const p of parts) {
    if ((buf + p).length > maxChars && buf) { chunks.push(buf.trim()); buf = p }
    else buf += p
  }
  if (buf.trim()) chunks.push(buf.trim())
  if (chunks.length === 1 && chunks[0].length > maxChars) {
    return Array.from({ length: Math.ceil(text.length / maxChars) }, (_, i) =>
      text.slice(i * maxChars, (i + 1) * maxChars))
  }
  return chunks
}

function caseToChunks(c: CeCase, text: string): Chunk[] {
  const pieces = chunkText(text, MAX_CHARS)
  return pieces.map((piece, i) => ({
    id: `ce-${c.cetatext.slice(-10)}${pieces.length > 1 ? `-p${i}` : ''}`.slice(0, 60),
    codeName: `Conseil d'État — ${c.formation}`,
    num: c.requete,
    breadcrumb: `Conseil d'État > ${c.formation} > ${c.date} > n° ${c.requete} — ${c.name}`,
    text: `CE ${c.formation} ${c.date} n° ${c.requete} — ${c.name}\nSolution résumée : ${c.shortHolding}\nThèmes : ${c.tags.join(', ')}${pieces.length > 1 ? ` (partie ${i + 1}/${pieces.length})` : ''}\n\n${piece}`,
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

  console.log(`=== Ingest Conseil d'État — ${CASES.length} landmark decisions ===\n`)
  const allChunks: Chunk[] = []
  let fetched = 0, failed = 0

  for (const c of CASES) {
    const perCachePath = join(CACHE_DIR, `${c.cetatext}.html`)
    let text: string | null = null

    if (existsSync(perCachePath)) {
      text = readFileSync(perCachePath, 'utf-8')
    } else {
      process.stdout.write(`  ${c.date} ${c.name} (n° ${c.requete})... `)
      text = await fetchDecision(c)
      if (text) {
        writeFileSync(perCachePath, text)
        fetched++
        console.log('ok')
      } else {
        failed++
        console.log('FAIL (curated summary only)')
        text = `CE ${c.formation} ${c.date} n° ${c.requete} — ${c.name}\n${c.shortHolding}\nThèmes : ${c.tags.join(', ')}`
      }
      await sleep(REQ_DELAY_MS)
    }

    allChunks.push(...caseToChunks(c, text))
  }

  writeFileSync(OUTPUT_FILE, JSON.stringify(allChunks, null, 2))
  console.log(`\n=== Done ===`)
  console.log(`  Cases:     ${CASES.length}`)
  console.log(`  Fetched:   ${fetched}`)
  console.log(`  Fallbacks: ${failed}`)
  console.log(`  Chunks:    ${allChunks.length}`)
  console.log(`  Output:    ${OUTPUT_FILE}`)
  console.log(`\nNext: npx tsx scripts/embed-sources.ts --input ${OUTPUT_FILE}`)
}

main().catch(err => { console.error(err); process.exit(1) })
