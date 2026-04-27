#!/usr/bin/env npx tsx
/* eslint-disable no-console */
/**
 * Ingest French constitutional texts (bloc de constitutionnalité).
 *
 * Constitution 1958 is fetched via Legifrance (LEGITEXT000006071194).
 * DDHC 1789 and Préambule 1946 are embedded as static text (short, public-domain,
 * historically stable so no need to round-trip Legifrance).
 *
 * Usage:
 *   npx tsx scripts/ingest-constitution.ts \
 *     --piste-client-id $PISTE_OAUTH_CLIENT_ID \
 *     --piste-client-secret $PISTE_OAUTH_CLIENT_SECRET
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { parseArgs } from 'util'

import {
  fetchLegiPart,
  fetchArticlesBatch,
  chunkArticles,
  slugify,
  type FetchedArticle,
  type Chunk,
} from './lib/legifranceClient'

// ─── CLI ────────────────────────────────────────────────

const { values } = parseArgs({
  options: {
    'output-dir': { type: 'string', default: 'legal-sources-output' },
    'piste-client-id': { type: 'string' },
    'piste-client-secret': { type: 'string' },
  },
})

const outputDir = values['output-dir'] ?? 'legal-sources-output'
const clientId = values['piste-client-id'] ?? process.env.PISTE_OAUTH_CLIENT_ID
const clientSecret = values['piste-client-secret'] ?? process.env.PISTE_OAUTH_CLIENT_SECRET

if (!clientId || !clientSecret) {
  console.error('Missing PISTE credentials. Pass --piste-client-id / --piste-client-secret or set env vars.')
  process.exit(1)
}

// ─── Constitution 1958 via Legifrance ──────────────────

const CONSTITUTION_1958 = {
  textId: 'LEGITEXT000006071194',
  title: 'Constitution du 4 octobre 1958',
  slug: 'constitution-1958',
}

// ─── DDHC 1789 (static — 17 articles, public domain) ───

const DDHC_1789_ARTICLES: Array<{ num: string; text: string }> = [
  { num: '1', text: "Les hommes naissent et demeurent libres et égaux en droits. Les distinctions sociales ne peuvent être fondées que sur l'utilité commune." },
  { num: '2', text: "Le but de toute association politique est la conservation des droits naturels et imprescriptibles de l'homme. Ces droits sont la liberté, la propriété, la sûreté, et la résistance à l'oppression." },
  { num: '3', text: "Le principe de toute souveraineté réside essentiellement dans la nation. Nul corps, nul individu ne peut exercer d'autorité qui n'en émane expressément." },
  { num: '4', text: "La liberté consiste à pouvoir faire tout ce qui ne nuit pas à autrui : ainsi, l'exercice des droits naturels de chaque homme n'a de bornes que celles qui assurent aux autres membres de la société la jouissance de ces mêmes droits. Ces bornes ne peuvent être déterminées que par la loi." },
  { num: '5', text: "La loi n'a le droit de défendre que les actions nuisibles à la société. Tout ce qui n'est pas défendu par la loi ne peut être empêché, et nul ne peut être contraint à faire ce qu'elle n'ordonne pas." },
  { num: '6', text: "La loi est l'expression de la volonté générale. Tous les citoyens ont droit de concourir personnellement, ou par leurs représentants, à sa formation. Elle doit être la même pour tous, soit qu'elle protège, soit qu'elle punisse. Tous les citoyens étant égaux à ses yeux sont également admissibles à toutes dignités, places et emplois publics, selon leur capacité, et sans autre distinction que celle de leurs vertus et de leurs talents." },
  { num: '7', text: "Nul homme ne peut être accusé, arrêté ni détenu que dans les cas déterminés par la loi, et selon les formes qu'elle a prescrites. Ceux qui sollicitent, expédient, exécutent ou font exécuter des ordres arbitraires, doivent être punis ; mais tout citoyen appelé ou saisi en vertu de la loi doit obéir à l'instant : il se rend coupable par la résistance." },
  { num: '8', text: "La loi ne doit établir que des peines strictement et évidemment nécessaires, et nul ne peut être puni qu'en vertu d'une loi établie et promulguée antérieurement au délit, et légalement appliquée." },
  { num: '9', text: "Tout homme étant présumé innocent jusqu'à ce qu'il ait été déclaré coupable, s'il est jugé indispensable de l'arrêter, toute rigueur qui ne serait pas nécessaire pour s'assurer de sa personne doit être sévèrement réprimée par la loi." },
  { num: '10', text: "Nul ne doit être inquiété pour ses opinions, même religieuses, pourvu que leur manifestation ne trouble pas l'ordre public établi par la loi." },
  { num: '11', text: "La libre communication des pensées et des opinions est un des droits les plus précieux de l'homme : tout citoyen peut donc parler, écrire, imprimer librement, sauf à répondre de l'abus de cette liberté dans les cas déterminés par la loi." },
  { num: '12', text: "La garantie des droits de l'homme et du citoyen nécessite une force publique : cette force est donc instituée pour l'avantage de tous, et non pour l'utilité particulière de ceux auxquels elle est confiée." },
  { num: '13', text: "Pour l'entretien de la force publique, et pour les dépenses d'administration, une contribution commune est indispensable : elle doit être également répartie entre tous les citoyens, en raison de leurs facultés." },
  { num: '14', text: "Tous les citoyens ont le droit de constater, par eux-mêmes ou par leurs représentants, la nécessité de la contribution publique, de la consentir librement, d'en suivre l'emploi, et d'en déterminer la quotité, l'assiette, le recouvrement et la durée." },
  { num: '15', text: "La société a le droit de demander compte à tout agent public de son administration." },
  { num: '16', text: "Toute société dans laquelle la garantie des droits n'est pas assurée, ni la séparation des pouvoirs déterminée, n'a point de Constitution." },
  { num: '17', text: "La propriété étant un droit inviolable et sacré, nul ne peut en être privé, si ce n'est lorsque la nécessité publique, légalement constatée, l'exige évidemment, et sous la condition d'une juste et préalable indemnité." },
]

// ─── Préambule 1946 (static) ────────────────────────────

const PREAMBULE_1946_ALINEAS: Array<{ num: string; text: string }> = [
  { num: 'al.1', text: "Au lendemain de la victoire remportée par les peuples libres sur les régimes qui ont tenté d'asservir et de dégrader la personne humaine, le peuple français proclame à nouveau que tout être humain, sans distinction de race, de religion ni de croyance, possède des droits inaliénables et sacrés. Il réaffirme solennellement les droits et libertés de l'homme et du citoyen consacrés par la Déclaration des droits de 1789 et les principes fondamentaux reconnus par les lois de la République." },
  { num: 'al.2', text: "Il proclame, en outre, comme particulièrement nécessaires à notre temps, les principes politiques, économiques et sociaux ci-après :" },
  { num: 'al.3', text: "La loi garantit à la femme, dans tous les domaines, des droits égaux à ceux de l'homme." },
  { num: 'al.4', text: "Tout homme persécuté en raison de son action en faveur de la liberté a droit d'asile sur les territoires de la République." },
  { num: 'al.5', text: "Chacun a le devoir de travailler et le droit d'obtenir un emploi. Nul ne peut être lésé, dans son travail ou son emploi, en raison de ses origines, de ses opinions ou de ses croyances." },
  { num: 'al.6', text: "Tout homme peut défendre ses droits et ses intérêts par l'action syndicale et adhérer au syndicat de son choix." },
  { num: 'al.7', text: "Le droit de grève s'exerce dans le cadre des lois qui le réglementent." },
  { num: 'al.8', text: "Tout travailleur participe, par l'intermédiaire de ses délégués, à la détermination collective des conditions de travail ainsi qu'à la gestion des entreprises." },
  { num: 'al.9', text: "Tout bien, toute entreprise, dont l'exploitation a ou acquiert les caractères d'un service public national ou d'un monopole de fait, doit devenir la propriété de la collectivité." },
  { num: 'al.10', text: "La Nation assure à l'individu et à la famille les conditions nécessaires à leur développement." },
  { num: 'al.11', text: "Elle garantit à tous, notamment à l'enfant, à la mère et aux vieux travailleurs, la protection de la santé, la sécurité matérielle, le repos et les loisirs. Tout être humain qui, en raison de son âge, de son état physique ou mental, de la situation économique, se trouve dans l'incapacité de travailler a le droit d'obtenir de la collectivité des moyens convenables d'existence." },
  { num: 'al.12', text: "La Nation proclame la solidarité et l'égalité de tous les Français devant les charges qui résultent des calamités nationales." },
  { num: 'al.13', text: "La Nation garantit l'égal accès de l'enfant et de l'adulte à l'instruction, à la formation professionnelle et à la culture. L'organisation de l'enseignement public gratuit et laïque à tous les degrés est un devoir de l'État." },
  { num: 'al.14', text: "La République française, fidèle à ses traditions, se conforme aux règles du droit public international. Elle n'entreprendra aucune guerre dans des vues de conquête et n'emploiera jamais ses forces contre la liberté d'aucun peuple." },
  { num: 'al.15', text: "Sous réserve de réciprocité, la France consent aux limitations de souveraineté nécessaires à l'organisation et à la défense de la paix." },
  { num: 'al.16', text: "La France forme avec les peuples d'outre-mer une Union fondée sur l'égalité des droits et des devoirs, sans distinction de race ni de religion." },
  { num: 'al.17', text: "L'Union française est composée de nations et de peuples qui mettent en commun ou coordonnent leurs ressources et leurs efforts pour développer leurs civilisations respectives, accroître leur bien-être et assurer leur sécurité." },
  { num: 'al.18', text: "Fidèle à sa mission traditionnelle, la France entend conduire les peuples dont elle a pris la charge à la liberté de s'administrer eux-mêmes et de gérer démocratiquement leurs propres affaires ; écartant tout système de colonisation fondé sur l'arbitraire, elle garantit à tous l'égal accès aux fonctions publiques et l'exercice individuel ou collectif des droits et libertés proclamés ou confirmés ci-dessus." },
]

// ─── Main ───────────────────────────────────────────────

async function ingestConstitution1958(cId: string, cSecret: string): Promise<FetchedArticle[]> {
  console.log(`\nFetching ${CONSTITUTION_1958.title} (${CONSTITUTION_1958.textId})...`)
  const articleInfos = await fetchLegiPart(CONSTITUTION_1958.textId, cId, cSecret)
  console.log(`  Found ${articleInfos.length} articles in TOC`)
  if (articleInfos.length === 0) {
    console.log('  ⚠ No articles found (bad LEGITEXT id?); skipping')
    return []
  }
  const fetched = await fetchArticlesBatch(articleInfos, cId, cSecret, 10, 200)
  console.log(`  Fetched ${fetched.length}/${articleInfos.length} articles`)
  return fetched
}

function staticToChunks(
  entries: Array<{ num: string; text: string }>,
  codeName: string,
  codeSlug: string,
  breadcrumb: string,
): Chunk[] {
  return entries.map((e) => ({
    id: `${codeSlug}-${slugify(e.num)}`,
    codeName,
    num: e.num,
    breadcrumb,
    text: `${codeName} — ${e.num.startsWith('al') ? e.num : `art. ${e.num}`} — ${e.text}`,
  }))
}

async function main() {
  console.log('=== Constitutional Texts Ingestion ===')
  mkdirSync(join(outputDir, 'cache'), { recursive: true })
  mkdirSync(join(outputDir, 'chunks'), { recursive: true })

  const cachePath = join(outputDir, 'cache', 'constitution.json')
  const chunksPath = join(outputDir, 'chunks', 'constitution.json')

  let constitutionArticles: FetchedArticle[] = []
  if (existsSync(cachePath)) {
    console.log(`Using cached Constitution articles from ${cachePath}`)
    constitutionArticles = JSON.parse(readFileSync(cachePath, 'utf-8'))
  } else {
    constitutionArticles = await ingestConstitution1958(clientId!, clientSecret!)
    writeFileSync(cachePath, JSON.stringify(constitutionArticles))
  }

  const chunks: Chunk[] = []

  // Constitution 1958 (article-by-article)
  chunks.push(
    ...chunkArticles(
      constitutionArticles,
      CONSTITUTION_1958.title,
      CONSTITUTION_1958.slug,
    ),
  )

  // DDHC 1789 (static)
  chunks.push(
    ...staticToChunks(
      DDHC_1789_ARTICLES,
      "Déclaration des droits de l'homme et du citoyen de 1789",
      'ddhc-1789',
      'Bloc de constitutionnalité > DDHC 1789',
    ),
  )

  // Préambule 1946 (static)
  chunks.push(
    ...staticToChunks(
      PREAMBULE_1946_ALINEAS,
      'Préambule de la Constitution de 1946',
      'preambule-1946',
      'Bloc de constitutionnalité > Préambule 1946',
    ),
  )

  writeFileSync(chunksPath, JSON.stringify(chunks))
  console.log(`\n=== Done ===`)
  console.log(`Constitution 1958 articles: ${constitutionArticles.length}`)
  console.log(`DDHC 1789 articles: ${DDHC_1789_ARTICLES.length}`)
  console.log(`Préambule 1946 alinéas: ${PREAMBULE_1946_ALINEAS.length}`)
  console.log(`Total chunks: ${chunks.length}`)
  console.log(`Chunks → ${chunksPath}`)
  console.log(`Cache (Constitution only) → ${cachePath}`)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
