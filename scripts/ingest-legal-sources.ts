#!/usr/bin/env npx tsx
/* eslint-disable no-console */
/**
 * Ingest all non-code legal sources for CRFPA preparation:
 *   - Jurisprudence (Cour de Cassation via Judilibre)
 *   - Constitution, DDHC, Préambule 1946, Charte environnement
 *   - CEDH (Convention européenne des droits de l'homme)
 *   - RGPD (Regulation 2016/679)
 *   - Adages juridiques
 *
 * Usage:
 *   npx tsx scripts/ingest-legal-sources.ts \
 *     --admin-key $ADMIN_API_KEY \
 *     --api-url https://studieskit.com \
 *     [--output-dir legal-sources-output]
 *     [--skip-jurisprudence]  # skip the long Judilibre crawl
 */
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { parseArgs } from 'util'

const { values } = parseArgs({
  options: {
    'output-dir': { type: 'string', default: 'legal-sources-output' },
    'admin-key': { type: 'string' },
    'api-url': { type: 'string', default: 'https://studieskit.com' },
    'skip-jurisprudence': { type: 'boolean', default: false },
  },
})

const outputDir = values['output-dir'] ?? 'legal-sources-output'
const adminKey = values['admin-key']
const apiUrl = values['api-url'] ?? 'https://studieskit.com'
const skipJuris = values['skip-jurisprudence'] ?? false

if (!adminKey) {
  console.error('Usage: npx tsx scripts/ingest-legal-sources.ts --admin-key <key> [--api-url <url>]')
  process.exit(1)
}

const ADMIN_URL = `${apiUrl}/api/admin/legifrance-crawl`

function sleep(ms: number): Promise<void> { return new Promise(r => setTimeout(r, ms)) }

function slugify(t: string): string {
  return t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

async function adminCall(action: string, params: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(ADMIN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `ApiKey ${adminKey}` },
    body: JSON.stringify({ action, ...params }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Admin ${action}: ${res.status} ${text.slice(0, 300)}`)
  }
  return res.json()
}

interface Chunk {
  id: string
  codeName: string
  num: string
  breadcrumb: string
  text: string
}

// ─── 1. JURISPRUDENCE (Judilibre) ───────────────────────

// Judilibre chamber codes (verified against /search?chamber=... error message).
// Note: commercial is `comm` (not `com`), criminal is `cr` (not `crim`).
// Earlier incorrect codes produced silent 400 errors and empty cache files.
const CHAMBERS = [
  { code: 'soc',  name: 'Chambre sociale' },
  { code: 'civ1', name: 'Première chambre civile' },
  { code: 'civ2', name: 'Deuxième chambre civile' },
  { code: 'civ3', name: 'Troisième chambre civile' },
  { code: 'comm', name: 'Chambre commerciale' },
  { code: 'cr',   name: 'Chambre criminelle' },
  { code: 'mi',   name: 'Chambre mixte' },
  { code: 'pl',   name: 'Assemblée plénière' },
]

async function crawlJurisprudence(): Promise<Chunk[]> {
  console.log('\n=== Crawling Jurisprudence (Judilibre) ===')
  const chunks: Chunk[] = []
  const cacheDir = join(outputDir, 'cache', 'jurisprudence')
  mkdirSync(cacheDir, { recursive: true })

  for (const chamber of CHAMBERS) {
    const cachePath = join(cacheDir, `${chamber.code}.json`)
    if (existsSync(cachePath)) {
      const cached = JSON.parse(readFileSync(cachePath, 'utf-8')) as Chunk[]
      console.log(`  ${chamber.name}: ${cached.length} decisions (cached)`)
      chunks.push(...cached)
      continue
    }

    console.log(`  ${chamber.name}: crawling...`)
    const chamberChunks: Chunk[] = []
    let page = 0
    let total = 0

    // Fetch published decisions (most important ones)
    while (true) {
      try {
        const data = await adminCall('judilibreSearch', {
          query: '*',
          chamber: chamber.code,
          publication: 'b', // Published in bulletin = important decisions
          pageSize: 50,
          page,
        }) as { results?: Array<Record<string, unknown>>; total?: number; next_page?: string | null }

        const results = data.results ?? []
        if (results.length === 0) break
        if (page === 0) total = data.total ?? 0

        for (const r of results) {
          const id = String(r.id ?? '')
          const number = String(r.number ?? '')
          const date = String(r.decision_date ?? '')
          const solution = String(r.solution ?? '')
          const summary = String(r.summary ?? '')
          const themes = (r.themes as string[]) ?? []

          if (!summary.trim() && !themes.length) continue // skip empty

          const text = [
            `Cass. ${chamber.name}, ${date}, n° ${number}`,
            `Solution : ${solution}`,
            summary ? `\n${summary}` : '',
            themes.length ? `\nThèmes : ${themes.join(', ')}` : '',
          ].filter(Boolean).join('\n')

          const chunkId = `juris-${chamber.code}-${slugify(number || id)}`.slice(0, 60)
          chamberChunks.push({
            id: chunkId,
            codeName: `Jurisprudence — ${chamber.name}`,
            num: number,
            breadcrumb: `Cour de cassation > ${chamber.name} > ${date}`,
            text,
          })
        }

        page++
        process.stdout.write(`    ${chamberChunks.length}/${total} decisions\r`)

        if (!data.next_page) break
        if (page > 40) break // Cap at ~2000 per chamber
        await sleep(300)
      } catch (err) {
        console.error(`    Error at page ${page}: ${(err as Error).message?.slice(0, 100)}`)
        break
      }
    }

    console.log(`    ✓ ${chamberChunks.length} decisions`)
    writeFileSync(cachePath, JSON.stringify(chamberChunks))
    chunks.push(...chamberChunks)
    await sleep(500)
  }

  return chunks
}

// ─── 2. CONSTITUTION + BLOC DE CONSTITUTIONNALITÉ ───────

const CONSTITUTIONAL_TEXTS: Array<{ title: string; articles: Array<{ num: string; text: string }> }> = [
  {
    title: 'Déclaration des Droits de l\'Homme et du Citoyen de 1789',
    articles: [
      { num: '1', text: 'Les hommes naissent et demeurent libres et égaux en droits. Les distinctions sociales ne peuvent être fondées que sur l\'utilité commune.' },
      { num: '2', text: 'Le but de toute association politique est la conservation des droits naturels et imprescriptibles de l\'Homme. Ces droits sont la liberté, la propriété, la sûreté, et la résistance à l\'oppression.' },
      { num: '3', text: 'Le principe de toute Souveraineté réside essentiellement dans la Nation. Nul corps, nul individu ne peut exercer d\'autorité qui n\'en émane expressément.' },
      { num: '4', text: 'La liberté consiste à pouvoir faire tout ce qui ne nuit pas à autrui : ainsi, l\'exercice des droits naturels de chaque homme n\'a de bornes que celles qui assurent aux autres Membres de la Société la jouissance de ces mêmes droits. Ces bornes ne peuvent être déterminées que par la Loi.' },
      { num: '5', text: 'La Loi n\'a le droit de défendre que les actions nuisibles à la Société. Tout ce qui n\'est pas défendu par la Loi ne peut être empêché, et nul ne peut être contraint à faire ce qu\'elle n\'ordonne pas.' },
      { num: '6', text: 'La Loi est l\'expression de la volonté générale. Tous les Citoyens ont droit de concourir personnellement, ou par leurs Représentants, à sa formation. Elle doit être la même pour tous, soit qu\'elle protège, soit qu\'elle punisse. Tous les Citoyens étant égaux à ses yeux sont également admissibles à toutes dignités, places et emplois publics, selon leur capacité, et sans autre distinction que celle de leurs vertus et de leurs talents.' },
      { num: '7', text: 'Nul homme ne peut être accusé, arrêté ni détenu que dans les cas déterminés par la Loi, et selon les formes qu\'elle a prescrites. Ceux qui sollicitent, expédient, exécutent ou font exécuter des ordres arbitraires, doivent être punis ; mais tout Citoyen appelé ou saisi en vertu de la Loi doit obéir à l\'instant : il se rend coupable par la résistance.' },
      { num: '8', text: 'La Loi ne doit établir que des peines strictement et évidemment nécessaires, et nul ne peut être puni qu\'en vertu d\'une Loi établie et promulguée antérieurement au délit, et légalement appliquée.' },
      { num: '9', text: 'Tout homme étant présumé innocent jusqu\'à ce qu\'il ait été déclaré coupable, s\'il est jugé indispensable de l\'arrêter, toute rigueur qui ne serait pas nécessaire pour s\'assurer de sa personne doit être sévèrement réprimée par la loi.' },
      { num: '10', text: 'Nul ne doit être inquiété pour ses opinions, même religieuses, pourvu que leur manifestation ne trouble pas l\'ordre public établi par la Loi.' },
      { num: '11', text: 'La libre communication des pensées et des opinions est un des droits les plus précieux de l\'Homme : tout Citoyen peut donc parler, écrire, imprimer librement, sauf à répondre de l\'abus de cette liberté dans les cas déterminés par la Loi.' },
      { num: '12', text: 'La garantie des droits de l\'Homme et du Citoyen nécessite une force publique : cette force est donc instituée pour l\'avantage de tous, et non pour l\'utilité particulière de ceux auxquels elle est confiée.' },
      { num: '13', text: 'Pour l\'entretien de la force publique, et pour les dépenses d\'administration, une contribution commune est indispensable : elle doit être également répartie entre tous les citoyens, en raison de leurs facultés.' },
      { num: '14', text: 'Tous les Citoyens ont le droit de constater, par eux-mêmes ou par leurs représentants, la nécessité de la contribution publique, de la consentir librement, d\'en suivre l\'emploi, et d\'en déterminer la quotité, l\'assiette, le recouvrement et la durée.' },
      { num: '15', text: 'La Société a le droit de demander compte à tout Agent public de son administration.' },
      { num: '16', text: 'Toute Société dans laquelle la garantie des Droits n\'est pas assurée, ni la séparation des Pouvoirs déterminée, n\'a point de Constitution.' },
      { num: '17', text: 'La propriété étant un droit inviolable et sacré, nul ne peut en être privé, si ce n\'est lorsque la nécessité publique, légalement constatée, l\'exige évidemment, et sous la condition d\'une juste et préalable indemnité.' },
    ],
  },
]

// ─── 3. CEDH ────────────────────────────────────────────

const CEDH_ARTICLES: Array<{ num: string; text: string }> = [
  { num: '2', text: 'Droit à la vie — Le droit de toute personne à la vie est protégé par la loi. La mort ne peut être infligée à quiconque intentionnellement, sauf en exécution d\'une sentence capitale prononcée par un tribunal au cas où le délit est puni de cette peine par la loi.' },
  { num: '3', text: 'Interdiction de la torture — Nul ne peut être soumis à la torture ni à des peines ou traitements inhumains ou dégradants.' },
  { num: '4', text: 'Interdiction de l\'esclavage et du travail forcé — Nul ne peut être tenu en esclavage ni en servitude. Nul ne peut être astreint à accomplir un travail forcé ou obligatoire.' },
  { num: '5', text: 'Droit à la liberté et à la sûreté — Toute personne a droit à la liberté et à la sûreté. Nul ne peut être privé de sa liberté, sauf dans les cas suivants et selon les voies légales.' },
  { num: '6', text: 'Droit à un procès équitable — Toute personne a droit à ce que sa cause soit entendue équitablement, publiquement et dans un délai raisonnable, par un tribunal indépendant et impartial, établi par la loi.' },
  { num: '7', text: 'Pas de peine sans loi — Nul ne peut être condamné pour une action ou une omission qui, au moment où elle a été commise, ne constituait pas une infraction d\'après le droit national ou international.' },
  { num: '8', text: 'Droit au respect de la vie privée et familiale — Toute personne a droit au respect de sa vie privée et familiale, de son domicile et de sa correspondance.' },
  { num: '9', text: 'Liberté de pensée, de conscience et de religion — Toute personne a droit à la liberté de pensée, de conscience et de religion.' },
  { num: '10', text: 'Liberté d\'expression — Toute personne a droit à la liberté d\'expression. Ce droit comprend la liberté d\'opinion et la liberté de recevoir ou de communiquer des informations ou des idées sans qu\'il puisse y avoir ingérence d\'autorités publiques et sans considération de frontière.' },
  { num: '11', text: 'Liberté de réunion et d\'association — Toute personne a droit à la liberté de réunion pacifique et à la liberté d\'association, y compris le droit de fonder avec d\'autres des syndicats et de s\'affilier à des syndicats pour la défense de ses intérêts.' },
  { num: '12', text: 'Droit au mariage — A partir de l\'âge nubile, l\'homme et la femme ont le droit de se marier et de fonder une famille selon les lois nationales régissant l\'exercice de ce droit.' },
  { num: '13', text: 'Droit à un recours effectif — Toute personne dont les droits et libertés reconnus dans la présente Convention ont été violés, a droit à l\'octroi d\'un recours effectif devant une instance nationale.' },
  { num: '14', text: 'Interdiction de discrimination — La jouissance des droits et libertés reconnus dans la présente Convention doit être assurée, sans distinction aucune, fondée notamment sur le sexe, la race, la couleur, la langue, la religion, les opinions politiques ou toutes autres opinions, l\'origine nationale ou sociale, l\'appartenance à une minorité nationale, la fortune, la naissance ou toute autre situation.' },
  { num: 'P1-1', text: 'Protection de la propriété (Protocole 1) — Toute personne physique ou morale a droit au respect de ses biens. Nul ne peut être privé de sa propriété que pour cause d\'utilité publique et dans les conditions prévues par la loi et les principes généraux du droit international.' },
  { num: 'P1-2', text: 'Droit à l\'instruction (Protocole 1) — Nul ne peut se voir refuser le droit à l\'instruction.' },
]

// ─── 4. ADAGES JURIDIQUES ───────────────────────────────

const ADAGES: Array<{ latin: string; french: string; meaning: string }> = [
  { latin: 'Nul n\'est censé ignorer la loi', french: 'Nemo censetur ignorare legem', meaning: 'Personne ne peut invoquer l\'ignorance de la loi pour échapper à son application. Principe fondamental du droit français.' },
  { latin: 'Fraus omnia corrumpit', french: 'La fraude corrompt tout', meaning: 'Un acte entaché de fraude ne peut produire aucun effet juridique. La fraude fait exception à toutes les règles.' },
  { latin: 'Nemo auditur propriam turpitudinem allegans', french: 'Nul ne peut se prévaloir de sa propre turpitude', meaning: 'Personne ne peut invoquer en justice sa propre faute ou immoralité pour obtenir un avantage.' },
  { latin: 'Accessorium sequitur principale', french: 'L\'accessoire suit le principal', meaning: 'Ce qui est accessoire suit le sort de la chose principale (sûretés, intérêts, etc.).' },
  { latin: 'Specialia generalibus derogant', french: 'Les lois spéciales dérogent aux lois générales', meaning: 'Lorsqu\'une loi spéciale contredit une loi générale, c\'est la loi spéciale qui s\'applique.' },
  { latin: 'Lex posterior derogat legi priori', french: 'La loi postérieure déroge à la loi antérieure', meaning: 'En cas de conflit entre deux lois de même rang, la plus récente l\'emporte.' },
  { latin: 'Non bis in idem', french: 'Pas deux fois pour la même chose', meaning: 'Nul ne peut être poursuivi ou puni deux fois pour les mêmes faits.' },
  { latin: 'Actori incumbit probatio', french: 'La preuve incombe au demandeur', meaning: 'C\'est à celui qui allègue un fait d\'en rapporter la preuve (Art. 1353 Code civil).' },
  { latin: 'Res judicata pro veritate habetur', french: 'La chose jugée est tenue pour vérité', meaning: 'Les décisions de justice devenues définitives s\'imposent comme la vérité. Autorité de la chose jugée.' },
  { latin: 'Pacta sunt servanda', french: 'Les conventions doivent être respectées', meaning: 'Les parties sont liées par les contrats qu\'elles ont conclus (Art. 1103 Code civil : force obligatoire du contrat).' },
  { latin: 'In dubio pro reo', french: 'Le doute profite à l\'accusé', meaning: 'En matière pénale, l\'insuffisance de preuves doit conduire à la relaxe ou l\'acquittement. Présomption d\'innocence.' },
  { latin: 'Nulla poena sine lege', french: 'Pas de peine sans loi', meaning: 'Principe de légalité des délits et des peines. Aucune peine ne peut être prononcée si elle n\'est pas prévue par un texte (Art. 111-3 Code pénal).' },
  { latin: 'Electa una via', french: 'Une voie choisie', meaning: 'La victime qui a choisi de porter son action devant la juridiction civile ne peut plus saisir la juridiction pénale, et inversement.' },
  { latin: 'Le criminel tient le civil en l\'état', french: '', meaning: 'Le juge civil doit surseoir à statuer lorsqu\'une action pénale est en cours sur les mêmes faits.' },
  { latin: 'Aliments n\'arréragent pas', french: '', meaning: 'Les pensions alimentaires non réclamées dans les délais ne peuvent être exigées rétroactivement.' },
  { latin: 'En fait de meubles, la possession vaut titre', french: '', meaning: 'Art. 2276 Code civil. Le possesseur de bonne foi d\'un bien meuble en est considéré comme propriétaire.' },
  { latin: 'Error communis facit jus', french: 'L\'erreur commune fait le droit', meaning: 'Lorsqu\'une erreur est partagée par tous, elle peut produire les mêmes effets que la réalité juridique (théorie de l\'apparence).' },
  { latin: 'Contra non valentem agere non currit praescriptio', french: '', meaning: 'La prescription ne court pas contre celui qui est dans l\'impossibilité d\'agir.' },
]

// ─── Main ───────────────────────────────────────────────

async function main() {
  console.log('=== Legal Sources Ingestion ===\n')
  mkdirSync(join(outputDir, 'cache'), { recursive: true })
  mkdirSync(join(outputDir, 'vectors'), { recursive: true })

  const allChunks: Chunk[] = []

  // 1. Jurisprudence
  if (!skipJuris) {
    const jurisChunks = await crawlJurisprudence()
    allChunks.push(...jurisChunks)
    console.log(`\nJurisprudence total: ${jurisChunks.length} decisions`)
  } else {
    console.log('Skipping jurisprudence (--skip-jurisprudence)')
    // Load from cache if available
    const cacheDir = join(outputDir, 'cache', 'jurisprudence')
    if (existsSync(cacheDir)) {
      for (const chamber of CHAMBERS) {
        const cachePath = join(cacheDir, `${chamber.code}.json`)
        if (existsSync(cachePath)) {
          allChunks.push(...JSON.parse(readFileSync(cachePath, 'utf-8')))
        }
      }
      console.log(`  Loaded ${allChunks.length} cached jurisprudence chunks`)
    }
  }

  // 2. Constitution / DDHC
  console.log('\n=== Constitutional texts ===')
  for (const doc of CONSTITUTIONAL_TEXTS) {
    for (const art of doc.articles) {
      allChunks.push({
        id: `ddhc-art-${slugify(art.num)}`,
        codeName: doc.title,
        num: art.num,
        breadcrumb: doc.title,
        text: `Art. ${art.num} — ${art.text}`,
      })
    }
    console.log(`  ${doc.title}: ${doc.articles.length} articles`)
  }

  // 3. CEDH
  console.log('\n=== CEDH ===')
  for (const art of CEDH_ARTICLES) {
    allChunks.push({
      id: `cedh-art-${slugify(art.num)}`,
      codeName: 'Convention européenne des droits de l\'homme',
      num: art.num,
      breadcrumb: 'CEDH',
      text: `Art. ${art.num} CEDH — ${art.text}`,
    })
  }
  console.log(`  ${CEDH_ARTICLES.length} articles`)

  // 4. Adages
  console.log('\n=== Adages juridiques ===')
  for (const adage of ADAGES) {
    const title = adage.latin || adage.french
    allChunks.push({
      id: `adage-${slugify(title)}`.slice(0, 60),
      codeName: 'Adages juridiques',
      num: title,
      breadcrumb: 'Principes généraux du droit',
      text: `${title}${adage.french && adage.latin !== adage.french ? ` (${adage.french})` : ''} — ${adage.meaning}`,
    })
  }
  console.log(`  ${ADAGES.length} adages`)

  console.log(`\n=== Total: ${allChunks.length} chunks ===`)

  // Write chunks to cache for embedding
  writeFileSync(join(outputDir, 'all-sources-chunks.json'), JSON.stringify(allChunks))
  console.log(`Chunks saved to ${outputDir}/all-sources-chunks.json`)
  console.log(`\nNext: embed with E5-large and upload to Vectorize`)
  console.log(`  npx tsx scripts/embed-sources.ts --input ${outputDir}/all-sources-chunks.json --output-dir ${outputDir}`)
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
