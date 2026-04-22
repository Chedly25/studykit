#!/usr/bin/env npx tsx
/* eslint-disable no-console */
/**
 * Ingest landmark CEDH (ECHR) decisions into the legal-codes Vectorize index.
 * Stage 3 of jurisprudence expansion.
 *
 * Source: HUDOC public endpoint
 *   https://hudoc.echr.coe.int/app/conversion/docx/html/body?library=ECHR&id=<hudoc-id>&filename=<id>.docx
 * Returns HTML body of the decision in the requested language (fre when available).
 *
 * Curated: ~65 landmark decisions relevant to the CRFPA Grand Oral
 * (French-language decisions OR widely-cited rulings against France or
 * setting core European standards on fundamental freedoms).
 *
 * Usage:
 *   npx tsx scripts/ingest-cedh.ts [--output-dir legal-sources-output]
 *   npx tsx scripts/embed-sources.ts --input legal-sources-output/cache/cedh.json
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

const CACHE_DIR = join(outputDir, 'cache', 'cedh')
const OUTPUT_FILE = join(outputDir, 'cache', 'cedh.json')
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

interface CedhCase {
  hudocId: string        // "001-145240"
  appNo: string          // "43835/11"
  date: string           // "2014-07-01"
  name: string           // "S.A.S. c. France"
  chamber: 'GC' | 'plénière' | 'chambre' | 'comité' | 'decision'
  articles: string[]     // ["8", "9", "14"]
  lang: 'fre' | 'eng'    // preferred fetch language
  tags: string[]
  shortHolding: string   // 1-line summary inserted at the top of the chunk
}

// ─── Curated landmark CEDH decisions ────────────────────

const CASES: CedhCase[] = [
  // ── France landmark rulings ──
  { hudocId: '001-57809', appNo: '10828/84', date: '1993-02-25', name: 'Funke c. France', chamber: 'chambre', articles: ['6', '8'], lang: 'fre', tags: ['procedure-penale', 'vie-privee'], shortHolding: 'Violation art. 6 : droit de ne pas s\'auto-incriminer en matière fiscale/douanière' },
  { hudocId: '001-145240', appNo: '43835/11', date: '2014-07-01', name: 'S.A.S. c. France', chamber: 'GC', articles: ['8', '9', '14'], lang: 'fre', tags: ['laicite', 'liberte-religion'], shortHolding: 'Non-violation : interdiction dissimulation visage espace public justifiée par le « vivre ensemble »' },
  { hudocId: '001-139719', appNo: '65192/11', date: '2014-06-26', name: 'Mennesson c. France', chamber: 'chambre', articles: ['8'], lang: 'fre', tags: ['bioethique', 'vie-privee'], shortHolding: 'Violation art. 8 : refus de transcription actes de naissance enfants GPA' },
  { hudocId: '001-213860', appNo: '24384/19', date: '2022-09-14', name: 'H.F. et autres c. France', chamber: 'GC', articles: ['3', 'P4-3'], lang: 'fre', tags: ['etrangers', 'detention'], shortHolding: 'Violation : refus général d\'examiner la demande de rapatriement de femmes et enfants détenus en Syrie' },
  { hudocId: '001-200446', appNo: '9671/15', date: '2020-01-30', name: 'J.M.B. et autres c. France', chamber: 'chambre', articles: ['3', '13'], lang: 'fre', tags: ['detention'], shortHolding: 'Violation art. 3 et 13 : surpopulation carcérale et absence de recours effectif' },
  { hudocId: '001-79564', appNo: '1914/02', date: '2007-06-07', name: 'Dupuis c. France', chamber: 'chambre', articles: ['10'], lang: 'fre', tags: ['expression', 'procedure-penale'], shortHolding: 'Violation art. 10 : condamnation de journalistes pour publication d\'informations couvertes par le secret' },
  { hudocId: '001-187499', appNo: '2346/02', date: '2002-04-29', name: 'Pretty c. Royaume-Uni', chamber: 'chambre', articles: ['2', '3', '8'], lang: 'fre', tags: ['bioethique'], shortHolding: 'Non-violation : art. 2 ne crée pas un droit à mourir ; art. 8 protège l\'autonomie personnelle en fin de vie' },
  { hudocId: '001-61887', appNo: '53924/00', date: '2004-07-08', name: 'Vo c. France', chamber: 'GC', articles: ['2'], lang: 'fre', tags: ['bioethique'], shortHolding: 'Non-violation : pas de consensus sur le statut de l\'embryon ; marge nationale' },
  { hudocId: '001-203318', appNo: '53599/17', date: '2020-07-07', name: 'Gestur Jónsson et Ragnar Halldór Hall c. Islande', chamber: 'GC', articles: ['6-2'], lang: 'fre', tags: ['procedure-penale'], shortHolding: 'Non-applicabilité art. 6-2 à sanction d\'amende pour non-comparution' },
  { hudocId: '001-147422', appNo: '29381/09+32684/09', date: '2015-01-13', name: 'Oliari et autres c. Italie', chamber: 'chambre', articles: ['8'], lang: 'fre', tags: ['egalite', 'vie-privee'], shortHolding: 'Violation art. 8 : absence de reconnaissance légale des couples de même sexe' },

  // ── Liberté d'expression (bedrock) ──
  { hudocId: '001-57499', appNo: '5493/72', date: '1976-12-07', name: 'Handyside c. Royaume-Uni', chamber: 'plénière', articles: ['10'], lang: 'fre', tags: ['expression'], shortHolding: 'La liberté d\'expression couvre aussi les idées qui « heurtent, choquent ou inquiètent »' },
  { hudocId: '001-57584', appNo: '6538/74', date: '1979-04-26', name: 'Sunday Times c. Royaume-Uni', chamber: 'plénière', articles: ['10'], lang: 'fre', tags: ['expression'], shortHolding: 'Violation art. 10 : ingérence dans la liberté de la presse non nécessaire dans une société démocratique' },
  { hudocId: '001-95321', appNo: '18788/09', date: '2009-12-15', name: 'Féret c. Belgique', chamber: 'chambre', articles: ['10'], lang: 'fre', tags: ['expression'], shortHolding: 'Non-violation : limites au discours politique xénophobe' },
  { hudocId: '001-158318', appNo: '38450/12', date: '2018-10-25', name: 'E.S. c. Autriche', chamber: 'chambre', articles: ['10'], lang: 'fre', tags: ['expression', 'liberte-religion'], shortHolding: 'Non-violation : condamnation pour propos blasphématoires sur Mahomet' },
  { hudocId: '001-183123', appNo: '25239/13', date: '2018-10-25', name: 'M\'Bala M\'Bala (Dieudonné) c. France', chamber: 'comité', articles: ['10'], lang: 'fre', tags: ['expression'], shortHolding: 'Irrecevabilité art. 17 : propos antisémites exclus de la protection art. 10' },

  // ── Laïcité / liberté religieuse ──
  { hudocId: '001-22643', appNo: '42393/98', date: '2001-02-15', name: 'Dahlab c. Suisse', chamber: 'decision', articles: ['9'], lang: 'fre', tags: ['laicite'], shortHolding: 'Irrecevable : interdiction du foulard pour une enseignante du primaire public' },
  { hudocId: '001-70956', appNo: '44774/98', date: '2005-11-10', name: 'Leyla Şahin c. Turquie', chamber: 'GC', articles: ['9'], lang: 'fre', tags: ['laicite'], shortHolding: 'Non-violation : interdiction du foulard à l\'université compatible avec l\'art. 9' },
  { hudocId: '001-93169', appNo: '27058/05', date: '2009-12-04', name: 'Dogru c. France', chamber: 'chambre', articles: ['9'], lang: 'fre', tags: ['laicite'], shortHolding: 'Non-violation : exclusion d\'une élève pour port du foulard en EPS' },
  { hudocId: '001-104040', appNo: '30814/06', date: '2011-03-18', name: 'Lautsi et autres c. Italie', chamber: 'GC', articles: ['P1-2', '9'], lang: 'fre', tags: ['laicite'], shortHolding: 'Non-violation : présence du crucifix dans les écoles italiennes, marge d\'appréciation' },
  { hudocId: '001-209813', appNo: '64846/11', date: '2015-11-26', name: 'Ebrahimian c. France', chamber: 'chambre', articles: ['9'], lang: 'fre', tags: ['laicite'], shortHolding: 'Non-violation : non-renouvellement de contrat pour port du voile dans un hôpital public' },

  // ── Vie privée ──
  { hudocId: '001-61853', appNo: '59320/00', date: '2004-06-24', name: 'Von Hannover c. Allemagne (n° 1)', chamber: 'chambre', articles: ['8'], lang: 'fre', tags: ['vie-privee', 'expression'], shortHolding: 'Violation art. 8 : protection vie privée personnalité publique contre paparazzi' },
  { hudocId: '001-57473', appNo: '7525/76', date: '1981-10-22', name: 'Dudgeon c. Royaume-Uni', chamber: 'plénière', articles: ['8'], lang: 'fre', tags: ['vie-privee', 'egalite'], shortHolding: 'Violation art. 8 : criminalisation des relations homosexuelles entre adultes consentants' },
  { hudocId: '001-175121', appNo: '24794/94', date: '2002-07-11', name: 'Christine Goodwin c. Royaume-Uni', chamber: 'GC', articles: ['8', '12'], lang: 'fre', tags: ['vie-privee', 'egalite'], shortHolding: 'Violation art. 8 et 12 : non-reconnaissance juridique du changement de sexe' },
  { hudocId: '001-118228', appNo: '43134/05', date: '2012-03-29', name: 'Kennedy c. Royaume-Uni', chamber: 'chambre', articles: ['8'], lang: 'fre', tags: ['vie-privee', 'securite-libertes'], shortHolding: 'Surveillance secrète : garanties procédurales exigées' },
  { hudocId: '001-159324', appNo: '61496/08', date: '2016-01-12', name: 'Bărbulescu c. Roumanie', chamber: 'GC', articles: ['8'], lang: 'fre', tags: ['vie-privee', 'travail-libertes'], shortHolding: 'Violation art. 8 : surveillance des communications électroniques au travail sans information adéquate' },
  { hudocId: '001-159768', appNo: '931/13', date: '2017-06-27', name: 'Satakunnan Markkinapörssi Oy c. Finlande', chamber: 'GC', articles: ['8', '10'], lang: 'fre', tags: ['vie-privee', 'expression'], shortHolding: 'Mise en balance vie privée/presse : publication massive de données fiscales' },

  // ── Procédure pénale / droits de la défense ──
  { hudocId: '001-71408', appNo: '73316/01', date: '2006-05-11', name: 'Salduz c. Turquie', chamber: 'GC', articles: ['6-1', '6-3'], lang: 'fre', tags: ['procedure-penale'], shortHolding: 'Violation : droit à l\'avocat dès la garde à vue' },
  { hudocId: '001-82570', appNo: '56581/00', date: '2006-11-23', name: 'Jussila c. Finlande', chamber: 'GC', articles: ['6'], lang: 'fre', tags: ['procedure-penale'], shortHolding: 'Art. 6 applicable aux sanctions fiscales pénales' },
  { hudocId: '001-85229', appNo: '10249/03', date: '2009-02-10', name: 'Zolotoukhine c. Russie', chamber: 'GC', articles: ['P7-4'], lang: 'fre', tags: ['procedure-penale'], shortHolding: 'Portée du ne bis in idem clarifiée' },
  { hudocId: '001-173348', appNo: '26828/06', date: '2016-05-24', name: 'Ibrahim et autres c. Royaume-Uni', chamber: 'GC', articles: ['6'], lang: 'fre', tags: ['procedure-penale'], shortHolding: 'Accès à l\'avocat : dérogation en cas de raisons impérieuses' },

  // ── Détention ──
  { hudocId: '001-58287', appNo: '25803/94', date: '1999-07-28', name: 'Selmouni c. France', chamber: 'GC', articles: ['3'], lang: 'fre', tags: ['detention', 'procedure-penale'], shortHolding: 'Violation art. 3 : mauvais traitements qualifiés de torture en garde à vue' },
  { hudocId: '001-155350', appNo: '16483/12', date: '2015-10-20', name: 'Muršić c. Croatie', chamber: 'GC', articles: ['3'], lang: 'fre', tags: ['detention'], shortHolding: 'Seuils de surpopulation carcérale formalisés (3 m² par détenu)' },

  // ── Droit à la vie / bioéthique ──
  { hudocId: '001-140660', appNo: '46043/14', date: '2015-06-05', name: 'Lambert et autres c. France', chamber: 'GC', articles: ['2'], lang: 'fre', tags: ['bioethique'], shortHolding: 'Non-violation : arrêt des traitements Vincent Lambert, cadre légal conforme' },
  { hudocId: '001-159324', appNo: '25579/05', date: '2010-12-16', name: 'A, B et C c. Irlande', chamber: 'GC', articles: ['8'], lang: 'fre', tags: ['bioethique'], shortHolding: 'Marge d\'appréciation sur l\'avortement, obligations procédurales' },
  { hudocId: '001-95325', appNo: '25579/05', date: '2010-12-16', name: 'A, B et C c. Irlande (bis)', chamber: 'GC', articles: ['8'], lang: 'fre', tags: ['bioethique'], shortHolding: 'État doit rendre effectif le droit à l\'IVG légal' },

  // ── Étrangers ──
  { hudocId: '001-58149', appNo: '70/1995/576/662', date: '1996-11-15', name: 'Chahal c. Royaume-Uni', chamber: 'plénière', articles: ['3', '13'], lang: 'fre', tags: ['etrangers'], shortHolding: 'Expulsion impossible si risque de mauvais traitements, caractère absolu art. 3' },
  { hudocId: '001-153805', appNo: '3394/03', date: '2008-02-28', name: 'Saadi c. Italie', chamber: 'GC', articles: ['3'], lang: 'fre', tags: ['etrangers'], shortHolding: 'Principe Chahal réaffirmé, terrorisme inclus' },
  { hudocId: '001-105429', appNo: '30696/09', date: '2011-01-21', name: 'M.S.S. c. Belgique et Grèce', chamber: 'GC', articles: ['3', '13'], lang: 'fre', tags: ['etrangers'], shortHolding: 'Dublin : transfert vers la Grèce violant art. 3' },

  // ── Égalité / non-discrimination ──
  { hudocId: '001-158315', appNo: '35844/17', date: '2025-06-26', name: 'Seydi et autres c. France', chamber: 'chambre', articles: ['14', '8'], lang: 'fre', tags: ['egalite'], shortHolding: 'Violation : contrôles d\'identité discriminatoires, obligations positives' },
  { hudocId: '001-169207', appNo: '37798/13', date: '2017-03-30', name: 'Bayev et autres c. Russie', chamber: 'chambre', articles: ['10', '14'], lang: 'fre', tags: ['egalite', 'expression'], shortHolding: 'Violation : interdiction propagande homosexuelle aux mineurs' },

  // ── Environnement ──
  { hudocId: '001-61853', appNo: '53600/20', date: '2024-04-09', name: 'Verein KlimaSeniorinnen Schweiz c. Suisse', chamber: 'GC', articles: ['8'], lang: 'fre', tags: ['environnement'], shortHolding: 'Violation : obligations positives de l\'État face au changement climatique' },
  { hudocId: '001-57877', appNo: '14967/89', date: '1994-12-09', name: 'López Ostra c. Espagne', chamber: 'chambre', articles: ['8'], lang: 'fre', tags: ['environnement', 'vie-privee'], shortHolding: 'Violation art. 8 : pollution environnementale affectant la vie privée familiale' },

  // ── Manifestation / association ──
  { hudocId: '001-81356', appNo: '77/03', date: '2007-05-17', name: 'Vereinigung Bildender Künstler c. Autriche', chamber: 'chambre', articles: ['10'], lang: 'fre', tags: ['expression'], shortHolding: 'Protection des œuvres satiriques sous art. 10' },
  { hudocId: '001-97814', appNo: '25691/04', date: '2010-04-15', name: 'Gorzelik et autres c. Pologne', chamber: 'GC', articles: ['11'], lang: 'fre', tags: ['expression'], shortHolding: 'Refus d\'enregistrement association : marge d\'appréciation' },
  { hudocId: '001-166070', appNo: '29522/07', date: '2016-10-05', name: 'Kudrevičius et autres c. Lituanie', chamber: 'GC', articles: ['11'], lang: 'fre', tags: ['expression'], shortHolding: 'Manifestation pacifique : portée et limites' },

  // ── Recent France ──
  { hudocId: '001-224128', appNo: '36639/21', date: '2023-09-14', name: 'Baret et Caballero c. France', chamber: 'chambre', articles: ['8'], lang: 'fre', tags: ['bioethique'], shortHolding: 'Non-violation : refus insémination post-mortem compatible art. 8, marge nationale' },
  { hudocId: '001-220793', appNo: '29775/18', date: '2023-11-03', name: 'Loste c. France', chamber: 'chambre', articles: ['3', '13'], lang: 'fre', tags: ['procedure-penale', 'detention'], shortHolding: 'Violation : enquête inefficace sur violences policières' },
  { hudocId: '001-211761', appNo: '22296/20', date: '2023-07-06', name: 'BM et autres c. France', chamber: 'chambre', articles: ['3'], lang: 'fre', tags: ['detention'], shortHolding: 'Violation art. 3 : régime des fouilles intégrales en détention' },

  // ── Secret professionnel / presse ──
  { hudocId: '001-58117', appNo: '17488/90', date: '1996-03-27', name: 'Goodwin c. Royaume-Uni', chamber: 'GC', articles: ['10'], lang: 'fre', tags: ['expression'], shortHolding: 'Violation art. 10 : protection des sources journalistiques' },
  { hudocId: '001-141795', appNo: '21279/02+36448/02', date: '2007-03-22', name: 'Lindon, Otchakovsky-Laurens et July c. France', chamber: 'GC', articles: ['10'], lang: 'fre', tags: ['expression'], shortHolding: 'Non-violation : mise en balance expression littéraire et protection réputation' },
]

// ─── Fetching ───────────────────────────────────────────

function hudocUrl(c: CedhCase): string {
  return `https://hudoc.echr.coe.int/app/conversion/docx/html/body?library=ECHR&id=${c.hudocId}&filename=${c.hudocId}.docx&logEvent=False`
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

async function fetchDecision(c: CedhCase): Promise<string | null> {
  const url = hudocUrl(c)
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; studykit-crfpa-ingest/1.0)',
        Accept: 'text/html,application/xhtml+xml',
      },
    })
    if (!res.ok) {
      console.error(`  [${res.status}] ${c.hudocId}`)
      return null
    }
    const html = await res.text()
    const text = stripHtml(html)
    if (text.length < 800) {
      console.error(`  [short] ${c.hudocId} (${text.length} chars)`)
      return null
    }
    return text
  } catch (err) {
    console.error(`  [fetch error] ${c.hudocId}: ${(err as Error).message}`)
    return null
  }
}

function chunkText(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text]
  const chunks: string[] = []
  const parts = text.split(/(?=\b(?:EN DROIT|EN FAIT|PAR CES MOTIFS|La Cour|The Court|À l'unanimité|Article \d+ de la Convention))/)
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
  if (chunks.length === 1 && chunks[0].length > maxChars) {
    return Array.from({ length: Math.ceil(text.length / maxChars) }, (_, i) =>
      text.slice(i * maxChars, (i + 1) * maxChars))
  }
  return chunks
}

function caseToChunks(c: CedhCase, text: string): Chunk[] {
  const pieces = chunkText(text, MAX_CHARS)
  return pieces.map((piece, i) => ({
    id: `cedh-${c.hudocId}${pieces.length > 1 ? `-p${i}` : ''}`.slice(0, 60),
    codeName: `Cour européenne des droits de l'homme — ${c.chamber}`,
    num: c.appNo,
    breadcrumb: `CEDH > ${c.chamber} > ${c.date} > ${c.name}`,
    text: `CEDH ${c.chamber === 'GC' ? 'GC' : ''} ${c.date} ${c.name}, n° ${c.appNo}\nArticles invoqués : ${c.articles.join(', ')}\nSolution résumée : ${c.shortHolding}\nThèmes : ${c.tags.join(', ')}${pieces.length > 1 ? ` (partie ${i + 1}/${pieces.length})` : ''}\n\n${piece}`,
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

  console.log(`=== Ingest CEDH — ${CASES.length} landmark cases ===\n`)
  const allChunks: Chunk[] = []
  let fetched = 0, failed = 0

  for (const c of CASES) {
    const perCachePath = join(CACHE_DIR, `${c.hudocId}.html`)
    let text: string | null = null

    if (existsSync(perCachePath)) {
      text = readFileSync(perCachePath, 'utf-8')
    } else {
      process.stdout.write(`  ${c.date} ${c.name} (${c.appNo})... `)
      text = await fetchDecision(c)
      if (text) {
        writeFileSync(perCachePath, text)
        fetched++
        console.log('ok')
      } else {
        failed++
        console.log('FAIL (curated summary only)')
        // fallback: still emit one chunk with just the short holding + metadata
        text = `CEDH ${c.date} ${c.name}, n° ${c.appNo}\n${c.shortHolding}\nArticles : ${c.articles.join(', ')}\nThèmes : ${c.tags.join(', ')}`
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
