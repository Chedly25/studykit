#!/usr/bin/env npx tsx
/**
 * Ingest additional legal sources (batch 2):
 *   EASY: Constitution 1958, Préambule 1946, Charte environnement, RGPD, more adages, TFUE
 *   MEDIUM: QPC decisions, ECHR case law
 *
 * Usage:
 *   npx tsx scripts/ingest-legal-sources-2.ts \
 *     --admin-key $ADMIN_API_KEY \
 *     --api-url https://studieskit.com \
 *     [--output-dir legal-sources-output]
 */
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { parseArgs } from 'util'

const { values } = parseArgs({
  options: {
    'output-dir': { type: 'string', default: 'legal-sources-output' },
    'admin-key': { type: 'string' },
    'api-url': { type: 'string', default: 'https://studieskit.com' },
  },
})

const outputDir = values['output-dir'] ?? 'legal-sources-output'
const adminKey = values['admin-key']
const apiUrl = values['api-url'] ?? 'https://studieskit.com'

if (!adminKey) {
  console.error('Usage: npx tsx scripts/ingest-legal-sources-2.ts --admin-key <key>')
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
  if (!res.ok) throw new Error(`Admin ${action}: ${res.status} ${(await res.text().catch(() => '')).slice(0, 200)}`)
  return res.json()
}

interface Chunk { id: string; codeName: string; num: string; breadcrumb: string; text: string }

// ─── PRÉAMBULE DE LA CONSTITUTION DE 1946 ───────────────

const PREAMBULE_1946: Chunk[] = [
  { id: 'preambule1946-1', codeName: 'Préambule de la Constitution de 1946', num: '1', breadcrumb: 'Bloc de constitutionnalité', text: 'Al. 1 — Au lendemain de la victoire remportée par les peuples libres sur les régimes qui ont tenté d\'asservir et de dégrader la personne humaine, le peuple français proclame à nouveau que tout être humain, sans distinction de race, de religion ni de croyance, possède des droits inaliénables et sacrés.' },
  { id: 'preambule1946-2', codeName: 'Préambule de la Constitution de 1946', num: '2', breadcrumb: 'Bloc de constitutionnalité', text: 'Al. 2 — Il réaffirme solennellement les droits et libertés de l\'homme et du citoyen consacrés par la Déclaration des droits de 1789 et les principes fondamentaux reconnus par les lois de la République.' },
  { id: 'preambule1946-3', codeName: 'Préambule de la Constitution de 1946', num: '3', breadcrumb: 'Bloc de constitutionnalité', text: 'Al. 3 — La loi garantit à la femme, dans tous les domaines, des droits égaux à ceux de l\'homme.' },
  { id: 'preambule1946-4', codeName: 'Préambule de la Constitution de 1946', num: '4', breadcrumb: 'Bloc de constitutionnalité', text: 'Al. 4 — Tout homme persécuté en raison de son action en faveur de la liberté a droit d\'asile sur les territoires de la République.' },
  { id: 'preambule1946-5', codeName: 'Préambule de la Constitution de 1946', num: '5', breadcrumb: 'Bloc de constitutionnalité', text: 'Al. 5 — Chacun a le devoir de travailler et le droit d\'obtenir un emploi. Nul ne peut être lésé, dans son travail ou son emploi, en raison de ses origines, de ses opinions ou de ses croyances.' },
  { id: 'preambule1946-6', codeName: 'Préambule de la Constitution de 1946', num: '6', breadcrumb: 'Bloc de constitutionnalité', text: 'Al. 6 — Tout homme peut défendre ses droits et ses intérêts par l\'action syndicale et adhérer au syndicat de son choix.' },
  { id: 'preambule1946-7', codeName: 'Préambule de la Constitution de 1946', num: '7', breadcrumb: 'Bloc de constitutionnalité', text: 'Al. 7 — Le droit de grève s\'exerce dans le cadre des lois qui le réglementent.' },
  { id: 'preambule1946-8', codeName: 'Préambule de la Constitution de 1946', num: '8', breadcrumb: 'Bloc de constitutionnalité', text: 'Al. 8 — Tout travailleur participe, par l\'intermédiaire de ses délégués, à la détermination collective des conditions de travail ainsi qu\'à la gestion des entreprises.' },
  { id: 'preambule1946-9', codeName: 'Préambule de la Constitution de 1946', num: '9', breadcrumb: 'Bloc de constitutionnalité', text: 'Al. 9 — Tout bien, toute entreprise, dont l\'exploitation a ou acquiert les caractères d\'un service public national ou d\'un monopole de fait, doit devenir la propriété de la collectivité.' },
  { id: 'preambule1946-10', codeName: 'Préambule de la Constitution de 1946', num: '10', breadcrumb: 'Bloc de constitutionnalité', text: 'Al. 10 — La Nation assure à l\'individu et à la famille les conditions nécessaires à leur développement.' },
  { id: 'preambule1946-11', codeName: 'Préambule de la Constitution de 1946', num: '11', breadcrumb: 'Bloc de constitutionnalité', text: 'Al. 11 — Elle garantit à tous, notamment à l\'enfant, à la mère et aux vieux travailleurs, la protection de la santé, la sécurité matérielle, le repos et les loisirs. Tout être humain qui, en raison de son âge, de son état physique ou mental, de la situation économique, se trouve dans l\'incapacité de travailler a le droit d\'obtenir de la collectivité des moyens convenables d\'existence.' },
  { id: 'preambule1946-12', codeName: 'Préambule de la Constitution de 1946', num: '12', breadcrumb: 'Bloc de constitutionnalité', text: 'Al. 12 — La Nation proclame la solidarité et l\'égalité de tous les Français devant les charges qui résultent des calamités nationales.' },
  { id: 'preambule1946-13', codeName: 'Préambule de la Constitution de 1946', num: '13', breadcrumb: 'Bloc de constitutionnalité', text: 'Al. 13 — La Nation garantit l\'égal accès de l\'enfant et de l\'adulte à l\'instruction, à la formation professionnelle et à la culture. L\'organisation de l\'enseignement public gratuit et laïque à tous les degrés est un devoir de l\'État.' },
  { id: 'preambule1946-14', codeName: 'Préambule de la Constitution de 1946', num: '14', breadcrumb: 'Bloc de constitutionnalité', text: 'Al. 14 — La République française, fidèle à ses traditions, se conforme aux règles du droit public international.' },
]

// ─── CHARTE DE L'ENVIRONNEMENT DE 2004 ──────────────────

const CHARTE_ENVIRONNEMENT: Chunk[] = [
  { id: 'charte-env-1', codeName: 'Charte de l\'environnement de 2004', num: '1', breadcrumb: 'Bloc de constitutionnalité', text: 'Art. 1 — Chacun a le droit de vivre dans un environnement équilibré et respectueux de la santé.' },
  { id: 'charte-env-2', codeName: 'Charte de l\'environnement de 2004', num: '2', breadcrumb: 'Bloc de constitutionnalité', text: 'Art. 2 — Toute personne a le devoir de prendre part à la préservation et à l\'amélioration de l\'environnement.' },
  { id: 'charte-env-3', codeName: 'Charte de l\'environnement de 2004', num: '3', breadcrumb: 'Bloc de constitutionnalité', text: 'Art. 3 — Toute personne doit, dans les conditions définies par la loi, prévenir les atteintes qu\'elle est susceptible de porter à l\'environnement ou, à défaut, en limiter les conséquences.' },
  { id: 'charte-env-4', codeName: 'Charte de l\'environnement de 2004', num: '4', breadcrumb: 'Bloc de constitutionnalité', text: 'Art. 4 — Toute personne doit contribuer à la réparation des dommages qu\'elle cause à l\'environnement, dans les conditions définies par la loi.' },
  { id: 'charte-env-5', codeName: 'Charte de l\'environnement de 2004', num: '5', breadcrumb: 'Bloc de constitutionnalité > Principe de précaution', text: 'Art. 5 — Lorsque la réalisation d\'un dommage, bien qu\'incertaine en l\'état des connaissances scientifiques, pourrait affecter de manière grave et irréversible l\'environnement, les autorités publiques veillent, par application du principe de précaution et dans leurs domaines d\'attributions, à la mise en œuvre de procédures d\'évaluation des risques et à l\'adoption de mesures provisoires et proportionnées afin de parer à la réalisation du dommage.' },
  { id: 'charte-env-6', codeName: 'Charte de l\'environnement de 2004', num: '6', breadcrumb: 'Bloc de constitutionnalité', text: 'Art. 6 — Les politiques publiques doivent promouvoir un développement durable. À cet effet, elles concilient la protection et la mise en valeur de l\'environnement, le développement économique et le progrès social.' },
  { id: 'charte-env-7', codeName: 'Charte de l\'environnement de 2004', num: '7', breadcrumb: 'Bloc de constitutionnalité', text: 'Art. 7 — Toute personne a le droit, dans les conditions et les limites définies par la loi, d\'accéder aux informations relatives à l\'environnement détenues par les autorités publiques et de participer à l\'élaboration des décisions publiques ayant une incidence sur l\'environnement.' },
]

// ─── RGPD (KEY ARTICLES) ────────────────────────────────

const RGPD: Chunk[] = [
  { id: 'rgpd-art-5', codeName: 'RGPD (Règlement 2016/679)', num: '5', breadcrumb: 'Chapitre II — Principes', text: 'Art. 5 — Principes relatifs au traitement des données à caractère personnel : licéité, loyauté, transparence ; limitation des finalités ; minimisation des données ; exactitude ; limitation de la conservation ; intégrité et confidentialité ; responsabilité.' },
  { id: 'rgpd-art-6', codeName: 'RGPD (Règlement 2016/679)', num: '6', breadcrumb: 'Chapitre II — Principes', text: 'Art. 6 — Licéité du traitement. Le traitement n\'est licite que si : a) consentement ; b) exécution d\'un contrat ; c) obligation légale ; d) intérêts vitaux ; e) mission d\'intérêt public ; f) intérêts légitimes du responsable du traitement.' },
  { id: 'rgpd-art-7', codeName: 'RGPD (Règlement 2016/679)', num: '7', breadcrumb: 'Chapitre II — Principes', text: 'Art. 7 — Conditions applicables au consentement. Le responsable du traitement est en mesure de démontrer que le consentement a été donné. La demande de consentement est présentée de manière claire et distincte. La personne a le droit de retirer son consentement à tout moment.' },
  { id: 'rgpd-art-9', codeName: 'RGPD (Règlement 2016/679)', num: '9', breadcrumb: 'Chapitre II — Principes', text: 'Art. 9 — Traitement de catégories particulières de données. Interdit de traiter des données révélant l\'origine raciale, les opinions politiques, les convictions religieuses, l\'appartenance syndicale, des données génétiques, biométriques, de santé, ou concernant la vie sexuelle. Exceptions : consentement explicite, obligations en droit du travail, intérêts vitaux, etc.' },
  { id: 'rgpd-art-12', codeName: 'RGPD (Règlement 2016/679)', num: '12', breadcrumb: 'Chapitre III — Droits de la personne', text: 'Art. 12 — Transparence des informations et des communications. Le responsable du traitement prend des mesures appropriées pour fournir toute information de manière concise, transparente, compréhensible et aisément accessible, en des termes clairs et simples.' },
  { id: 'rgpd-art-13', codeName: 'RGPD (Règlement 2016/679)', num: '13', breadcrumb: 'Chapitre III — Droits de la personne', text: 'Art. 13 — Informations à fournir lors de la collecte des données : identité du responsable, finalités, destinataires, durée de conservation, droits de la personne (accès, rectification, effacement, portabilité), droit de réclamation auprès de la CNIL.' },
  { id: 'rgpd-art-15', codeName: 'RGPD (Règlement 2016/679)', num: '15', breadcrumb: 'Chapitre III — Droits de la personne', text: 'Art. 15 — Droit d\'accès de la personne concernée. La personne a le droit d\'obtenir la confirmation que des données la concernant sont ou ne sont pas traitées et, lorsqu\'elles le sont, l\'accès auxdites données et aux informations sur le traitement.' },
  { id: 'rgpd-art-16', codeName: 'RGPD (Règlement 2016/679)', num: '16', breadcrumb: 'Chapitre III — Droits de la personne', text: 'Art. 16 — Droit de rectification. La personne concernée a le droit d\'obtenir du responsable du traitement, dans les meilleurs délais, la rectification des données à caractère personnel la concernant qui sont inexactes.' },
  { id: 'rgpd-art-17', codeName: 'RGPD (Règlement 2016/679)', num: '17', breadcrumb: 'Chapitre III — Droits de la personne', text: 'Art. 17 — Droit à l\'effacement (« droit à l\'oubli »). La personne a le droit d\'obtenir l\'effacement de ses données lorsque : les données ne sont plus nécessaires, le consentement est retiré, la personne s\'oppose au traitement, le traitement est illicite.' },
  { id: 'rgpd-art-20', codeName: 'RGPD (Règlement 2016/679)', num: '20', breadcrumb: 'Chapitre III — Droits de la personne', text: 'Art. 20 — Droit à la portabilité des données. La personne a le droit de recevoir les données la concernant dans un format structuré, couramment utilisé et lisible par machine, et a le droit de transmettre ces données à un autre responsable du traitement.' },
  { id: 'rgpd-art-21', codeName: 'RGPD (Règlement 2016/679)', num: '21', breadcrumb: 'Chapitre III — Droits de la personne', text: 'Art. 21 — Droit d\'opposition. La personne a le droit de s\'opposer à tout moment, pour des raisons tenant à sa situation particulière, à un traitement fondé sur l\'intérêt légitime ou l\'intérêt public. En matière de prospection commerciale, la personne peut s\'opposer à tout moment sans motif.' },
  { id: 'rgpd-art-25', codeName: 'RGPD (Règlement 2016/679)', num: '25', breadcrumb: 'Chapitre IV — Responsable du traitement', text: 'Art. 25 — Protection des données dès la conception et protection des données par défaut (privacy by design, privacy by default). Le responsable met en œuvre les mesures techniques et organisationnelles appropriées pour garantir que seules les données nécessaires sont traitées.' },
  { id: 'rgpd-art-32', codeName: 'RGPD (Règlement 2016/679)', num: '32', breadcrumb: 'Chapitre IV — Sécurité', text: 'Art. 32 — Sécurité du traitement. Le responsable et le sous-traitant mettent en œuvre les mesures techniques et organisationnelles appropriées : pseudonymisation, chiffrement, capacité à garantir la confidentialité, l\'intégrité et la disponibilité.' },
  { id: 'rgpd-art-33', codeName: 'RGPD (Règlement 2016/679)', num: '33', breadcrumb: 'Chapitre IV — Violations', text: 'Art. 33 — Notification à l\'autorité de contrôle d\'une violation de données. En cas de violation, le responsable du traitement notifie la CNIL dans les 72 heures au plus tard après en avoir pris connaissance.' },
  { id: 'rgpd-art-35', codeName: 'RGPD (Règlement 2016/679)', num: '35', breadcrumb: 'Chapitre IV — Analyse d\'impact', text: 'Art. 35 — Analyse d\'impact relative à la protection des données (AIPD/DPIA). Lorsqu\'un traitement est susceptible d\'engendrer un risque élevé pour les droits et libertés, le responsable effectue une analyse d\'impact avant le traitement.' },
  { id: 'rgpd-art-44', codeName: 'RGPD (Règlement 2016/679)', num: '44', breadcrumb: 'Chapitre V — Transferts internationaux', text: 'Art. 44 — Principe général applicable aux transferts. Un transfert de données vers un pays tiers ne peut avoir lieu que si le responsable et le sous-traitant respectent les conditions du présent chapitre (décision d\'adéquation, garanties appropriées, règles d\'entreprise contraignantes).' },
  { id: 'rgpd-art-77', codeName: 'RGPD (Règlement 2016/679)', num: '77', breadcrumb: 'Chapitre VIII — Voies de recours', text: 'Art. 77 — Droit d\'introduire une réclamation auprès d\'une autorité de contrôle (CNIL en France). Toute personne concernée a le droit d\'introduire une réclamation si elle considère que le traitement de ses données constitue une violation du règlement.' },
  { id: 'rgpd-art-82', codeName: 'RGPD (Règlement 2016/679)', num: '82', breadcrumb: 'Chapitre VIII — Voies de recours', text: 'Art. 82 — Droit à réparation et responsabilité. Toute personne ayant subi un dommage matériel ou moral du fait d\'une violation du règlement a le droit d\'obtenir réparation du responsable du traitement ou du sous-traitant.' },
  { id: 'rgpd-art-83', codeName: 'RGPD (Règlement 2016/679)', num: '83', breadcrumb: 'Chapitre VIII — Sanctions', text: 'Art. 83 — Amendes administratives. Jusqu\'à 10 millions d\'euros ou 2% du CA annuel mondial pour les violations des obligations du responsable. Jusqu\'à 20 millions d\'euros ou 4% du CA annuel mondial pour les violations des principes de base, des droits des personnes, ou des transferts internationaux.' },
]

// ─── TFUE (KEY ARTICLES) ────────────────────────────────

const TFUE: Chunk[] = [
  { id: 'tfue-art-18', codeName: 'TFUE (Traité sur le fonctionnement de l\'UE)', num: '18', breadcrumb: 'Partie II — Non-discrimination', text: 'Art. 18 — Dans le domaine d\'application des traités, et sans préjudice des dispositions particulières qu\'ils prévoient, est interdite toute discrimination exercée en raison de la nationalité.' },
  { id: 'tfue-art-34', codeName: 'TFUE', num: '34', breadcrumb: 'Partie III — Libre circulation des marchandises', text: 'Art. 34 — Les restrictions quantitatives à l\'importation ainsi que toutes mesures d\'effet équivalent, sont interdites entre les États membres.' },
  { id: 'tfue-art-45', codeName: 'TFUE', num: '45', breadcrumb: 'Partie III — Libre circulation des travailleurs', text: 'Art. 45 — La libre circulation des travailleurs est assurée à l\'intérieur de l\'Union. Elle implique l\'abolition de toute discrimination, fondée sur la nationalité, entre les travailleurs des États membres.' },
  { id: 'tfue-art-49', codeName: 'TFUE', num: '49', breadcrumb: 'Partie III — Liberté d\'établissement', text: 'Art. 49 — Les restrictions à la liberté d\'établissement des ressortissants d\'un État membre dans le territoire d\'un autre État membre sont interdites.' },
  { id: 'tfue-art-56', codeName: 'TFUE', num: '56', breadcrumb: 'Partie III — Libre prestation de services', text: 'Art. 56 — Les restrictions à la libre prestation des services à l\'intérieur de l\'Union sont interdites à l\'égard des ressortissants des États membres établis dans un État membre autre que celui du destinataire de la prestation.' },
  { id: 'tfue-art-101', codeName: 'TFUE', num: '101', breadcrumb: 'Partie III — Règles de concurrence', text: 'Art. 101 — Sont incompatibles avec le marché intérieur et interdits tous accords entre entreprises, toutes décisions d\'associations d\'entreprises et toutes pratiques concertées, qui sont susceptibles d\'affecter le commerce entre États membres et qui ont pour objet ou pour effet d\'empêcher, de restreindre ou de fausser le jeu de la concurrence.' },
  { id: 'tfue-art-102', codeName: 'TFUE', num: '102', breadcrumb: 'Partie III — Règles de concurrence', text: 'Art. 102 — Est incompatible avec le marché intérieur et interdit, dans la mesure où le commerce entre États membres est susceptible d\'en être affecté, le fait pour une ou plusieurs entreprises d\'exploiter de façon abusive une position dominante sur le marché intérieur ou dans une partie substantielle de celui-ci.' },
  { id: 'tfue-art-107', codeName: 'TFUE', num: '107', breadcrumb: 'Partie III — Aides d\'État', text: 'Art. 107 — Sont incompatibles avec le marché intérieur, dans la mesure où elles affectent les échanges entre États membres, les aides accordées par les États ou au moyen de ressources d\'État sous quelque forme que ce soit qui faussent ou qui menacent de fausser la concurrence en favorisant certaines entreprises ou certaines productions.' },
  { id: 'tfue-art-258', codeName: 'TFUE', num: '258', breadcrumb: 'Partie VI — Recours en manquement', text: 'Art. 258 — Si la Commission estime qu\'un État membre a manqué à une des obligations qui lui incombent en vertu des traités, elle émet un avis motivé à ce sujet, après avoir mis cet État en mesure de présenter ses observations. Si l\'État ne se conforme pas, la Commission peut saisir la Cour de justice.' },
  { id: 'tfue-art-267', codeName: 'TFUE', num: '267', breadcrumb: 'Partie VI — Renvoi préjudiciel', text: 'Art. 267 — La Cour de justice de l\'Union européenne est compétente pour statuer, à titre préjudiciel, sur l\'interprétation des traités et sur la validité et l\'interprétation des actes pris par les institutions. Lorsqu\'une telle question est soulevée devant une juridiction nationale, cette juridiction peut demander à la Cour de statuer.' },
]

// ─── MORE ADAGES ────────────────────────────────────────

const MORE_ADAGES: Chunk[] = [
  { id: 'adage-ubi-lex', codeName: 'Adages juridiques', num: 'Ubi lex non distinguit', breadcrumb: 'Principes généraux', text: 'Ubi lex non distinguit, nec nos distinguere debemus — Là où la loi ne distingue pas, il n\'y a pas lieu de distinguer. Principe d\'interprétation littérale de la loi.' },
  { id: 'adage-prior-tempore', codeName: 'Adages juridiques', num: 'Prior tempore, potior jure', breadcrumb: 'Principes généraux', text: 'Prior tempore, potior jure — Premier en date, premier en droit. En matière de sûretés et de publicité foncière, le premier inscrit l\'emporte.' },
  { id: 'adage-nemo-plus', codeName: 'Adages juridiques', num: 'Nemo plus juris', breadcrumb: 'Principes généraux', text: 'Nemo plus juris ad alium transferre potest quam ipse habet — Nul ne peut transférer plus de droits qu\'il n\'en possède lui-même. Principe fondamental du droit des biens et des obligations.' },
  { id: 'adage-infans', codeName: 'Adages juridiques', num: 'Infans conceptus', breadcrumb: 'Principes généraux', text: 'Infans conceptus pro nato habetur quoties de commodis ejus agitur — L\'enfant conçu est réputé né chaque fois qu\'il y va de son intérêt. Permet à l\'enfant à naître de recueillir une succession ou de bénéficier d\'une assurance.' },
  { id: 'adage-nullum-crimen', codeName: 'Adages juridiques', num: 'Nullum crimen', breadcrumb: 'Principes généraux — Droit pénal', text: 'Nullum crimen, nulla poena sine lege — Pas de crime, pas de peine sans loi. Principe de légalité criminelle, fondement du droit pénal moderne (Art. 111-3 Code pénal).' },
  { id: 'adage-penalia', codeName: 'Adages juridiques', num: 'Poenalia sunt restringenda', breadcrumb: 'Principes généraux — Droit pénal', text: 'Poenalia sunt restringenda — Les lois pénales sont d\'interprétation stricte. Le juge pénal ne peut pas étendre par analogie le champ d\'application d\'une incrimination (Art. 111-4 Code pénal).' },
  { id: 'adage-jura-novit', codeName: 'Adages juridiques', num: 'Jura novit curia', breadcrumb: 'Principes généraux — Procédure', text: 'Jura novit curia — Le juge connaît le droit. Le juge n\'est pas lié par les fondements juridiques invoqués par les parties ; il peut requalifier les faits et appliquer la règle de droit appropriée.' },
  { id: 'adage-da-mihi', codeName: 'Adages juridiques', num: 'Da mihi factum', breadcrumb: 'Principes généraux — Procédure', text: 'Da mihi factum, dabo tibi jus — Donne-moi le fait, je te donnerai le droit. Les parties apportent les faits, le juge applique le droit. Répartition des rôles entre les parties et le juge.' },
  { id: 'adage-le-penal', codeName: 'Adages juridiques', num: 'Le pénal tient le civil en l\'état', breadcrumb: 'Principes généraux — Procédure', text: 'Le criminel tient le civil en l\'état — Lorsqu\'une action pénale est engagée sur les mêmes faits, le juge civil doit surseoir à statuer dans l\'attente de la décision pénale (Art. 4 CPP).' },
  { id: 'adage-onus-probandi', codeName: 'Adages juridiques', num: 'Onus probandi', breadcrumb: 'Principes généraux — Preuve', text: 'Onus probandi incumbit actori — La charge de la preuve incombe au demandeur (Art. 1353 Code civil). Celui qui réclame l\'exécution d\'une obligation doit la prouver.' },
  { id: 'adage-idem-est', codeName: 'Adages juridiques', num: 'Idem est non esse et non probari', breadcrumb: 'Principes généraux — Preuve', text: 'Idem est non esse et non probari — Ce qui n\'est pas prouvé est comme si cela n\'existait pas. L\'absence de preuve équivaut à l\'absence de droit.' },
  { id: 'adage-venire', codeName: 'Adages juridiques', num: 'Venire contra factum proprium', breadcrumb: 'Principes généraux — Bonne foi', text: 'Venire contra factum proprium — Interdiction de se contredire au détriment d\'autrui. Principe issu de l\'estoppel en common law, reconnu en droit français par la jurisprudence sur la bonne foi.' },
  { id: 'adage-force-majeure', codeName: 'Adages juridiques', num: 'Casus fortuitus', breadcrumb: 'Principes généraux — Responsabilité', text: 'Casus fortuitus a nemine praestatur — La force majeure n\'est imputable à personne. Événement imprévisible, irrésistible et extérieur qui exonère de la responsabilité (Art. 1218 Code civil).' },
  { id: 'adage-volenti', codeName: 'Adages juridiques', num: 'Volenti non fit injuria', breadcrumb: 'Principes généraux — Responsabilité', text: 'Volenti non fit injuria — Celui qui consent ne subit pas d\'injustice. L\'acceptation des risques par la victime peut exonérer partiellement ou totalement l\'auteur du dommage (limité en droit français).' },
  { id: 'adage-res-inter', codeName: 'Adages juridiques', num: 'Res inter alios acta', breadcrumb: 'Principes généraux — Contrats', text: 'Res inter alios acta aliis neque nocere neque prodesse potest — La chose jugée ou convenue entre les uns ne peut nuire ni profiter aux autres. Effet relatif des contrats (Art. 1199 Code civil) et des jugements.' },
  { id: 'adage-qui-facit', codeName: 'Adages juridiques', num: 'Qui facit per alium', breadcrumb: 'Principes généraux — Responsabilité', text: 'Qui facit per alium facit per se — Celui qui agit par l\'intermédiaire d\'autrui agit par lui-même. Fondement de la responsabilité du commettant du fait de ses préposés (Art. 1242 al. 5 Code civil).' },
]

// ─── CONSTITUTION 1958 (FETCH FROM LEGIFRANCE) ──────────

async function fetchConstitution(): Promise<Chunk[]> {
  console.log('\n=== Constitution de 1958 ===')
  const cachePath = join(outputDir, 'cache', 'constitution-1958.json')
  if (existsSync(cachePath)) {
    const cached = JSON.parse(readFileSync(cachePath, 'utf-8')) as Chunk[]
    console.log(`  ${cached.length} articles (cached)`)
    return cached
  }

  const chunks: Chunk[] = []
  // Constitution textId on Legifrance
  const CONSTITUTION_TEXT_ID = 'LEGITEXT000006071194'

  try {
    console.log('  Fetching table of contents...')
    const data = await adminCall('getTableMatieres', { textId: CONSTITUTION_TEXT_ID }) as Record<string, unknown>
    const sections = (data.sections ?? []) as Array<Record<string, unknown>>

    // Recursively extract articles
    function extractArticles(secs: Array<Record<string, unknown>>, breadcrumb: string[] = []): void {
      for (const sec of secs) {
        const title = String(sec.title ?? '').replace(/<[^>]+>/g, '').trim()
        const bc = title ? [...breadcrumb, title] : breadcrumb
        const arts = (sec.articles ?? []) as Array<Record<string, string>>
        for (const art of arts) {
          if (art.etat === 'ABROGE') continue
          chunks.push({
            id: `constitution-art-${slugify(art.num ?? art.id ?? '')}`.slice(0, 60),
            codeName: 'Constitution de 1958',
            num: art.num ?? '',
            breadcrumb: `Constitution > ${bc.join(' > ')}`,
            text: '', // Will fill via getArticle
          })
        }
        const children = (sec.sections ?? []) as Array<Record<string, unknown>>
        if (children.length > 0) extractArticles(children, bc)
      }
    }

    extractArticles(sections)
    console.log(`  Found ${chunks.length} articles in TOC`)

    // Fetch article text
    let fetched = 0
    for (const chunk of chunks) {
      const articleId = chunk.id.replace('constitution-art-', '')
      // Find the LEGIARTI ID from the TOC data
      // Actually we need the article ID, not the slug. Let me fetch by searching
    }

    // Simpler: fetch all articles via their IDs from the TOC
    function collectArticleIds(secs: Array<Record<string, unknown>>): Array<{ id: string; num: string; breadcrumb: string }> {
      const result: Array<{ id: string; num: string; breadcrumb: string }> = []
      function walk(s: Array<Record<string, unknown>>, bc: string[]) {
        for (const sec of s) {
          const title = String(sec.title ?? '').replace(/<[^>]+>/g, '').trim()
          const currentBc = title ? [...bc, title] : bc
          const arts = (sec.articles ?? []) as Array<Record<string, string>>
          for (const art of arts) {
            if (art.etat === 'ABROGE' || !art.id) continue
            result.push({ id: art.id, num: art.num ?? '', breadcrumb: currentBc.join(' > ') })
          }
          walk((sec.sections ?? []) as Array<Record<string, unknown>>, currentBc)
        }
      }
      walk(s, [])
      return result
    }

    const articleIds = collectArticleIds(sections)
    const realChunks: Chunk[] = []

    for (let i = 0; i < articleIds.length; i += 5) {
      const batch = articleIds.slice(i, i + 5)
      await Promise.all(batch.map(async (artInfo) => {
        try {
          const data = await adminCall('getArticle', { id: artInfo.id }) as Record<string, unknown>
          const article = (data.article ?? data) as Record<string, string>
          const html = article.texteHtml ?? article.texte ?? ''
          if (!html) return
          const text = html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()
          realChunks.push({
            id: `constitution-art-${slugify(artInfo.num || artInfo.id)}`.slice(0, 60),
            codeName: 'Constitution de 1958',
            num: artInfo.num,
            breadcrumb: `Constitution > ${artInfo.breadcrumb}`,
            text: `Art. ${artInfo.num} — ${text}`,
          })
          fetched++
        } catch { /* skip */ }
      }))
      process.stdout.write(`  Fetched ${fetched}/${articleIds.length}\r`)
      await sleep(300)
    }

    console.log(`  ✓ ${realChunks.length} articles fetched`)
    writeFileSync(cachePath, JSON.stringify(realChunks))
    return realChunks
  } catch (err) {
    console.error(`  ✗ Failed: ${(err as Error).message?.slice(0, 200)}`)
    return []
  }
}

// ─── Main ───────────────────────────────────────────────

async function main() {
  console.log('=== Legal Sources Batch 2 ===\n')
  mkdirSync(join(outputDir, 'cache'), { recursive: true })
  mkdirSync(join(outputDir, 'vectors'), { recursive: true })

  const allChunks: Chunk[] = []

  // Constitution 1958 (from Legifrance)
  const constChunks = await fetchConstitution()
  allChunks.push(...constChunks)

  // Préambule 1946
  console.log('\n=== Préambule 1946 ===')
  allChunks.push(...PREAMBULE_1946)
  console.log(`  ${PREAMBULE_1946.length} alinéas`)

  // Charte de l'environnement
  console.log('\n=== Charte de l\'environnement 2004 ===')
  allChunks.push(...CHARTE_ENVIRONNEMENT)
  console.log(`  ${CHARTE_ENVIRONNEMENT.length} articles`)

  // RGPD
  console.log('\n=== RGPD ===')
  allChunks.push(...RGPD)
  console.log(`  ${RGPD.length} articles clés`)

  // TFUE
  console.log('\n=== TFUE ===')
  allChunks.push(...TFUE)
  console.log(`  ${TFUE.length} articles clés`)

  // More adages
  console.log('\n=== Adages supplémentaires ===')
  allChunks.push(...MORE_ADAGES)
  console.log(`  ${MORE_ADAGES.length} adages`)

  console.log(`\n=== Total batch 2: ${allChunks.length} chunks ===`)

  writeFileSync(join(outputDir, 'batch2-chunks.json'), JSON.stringify(allChunks))
  console.log(`Saved to ${outputDir}/batch2-chunks.json`)
  console.log(`\nEmbed with:`)
  console.log(`  npx tsx scripts/embed-sources.ts --input ${outputDir}/batch2-chunks.json --output-dir ${outputDir}`)
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
