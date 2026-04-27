/**
 * Prompt templates for CRFPA Grand Oral — libertés et droits fondamentaux.
 *
 * Real Grand Oral topics come in 3 formats:
 * 1. Open question: "Existe-t-il un droit au silence en matière civile ?"
 * 2. Case commentary: "Cour de cassation, 21 janvier 2025, n° 23-12.525"
 * 3. Article commentary: "Article 10 de la DDHC"
 *
 * Topics cover: privacy, dignity, equality, bioethics, secularism, expression freedom,
 * environmental rights, AI, security vs liberty, judicial independence, ECHR, death/end of life,
 * family law, criminal procedure, press freedom, religious freedom, etc.
 */

// ─── Seed corpus shape (real past sujets from IEJ annales) ──────────

export type GrandOralSujetType = 'question' | 'case' | 'article'

export interface GrandOralSujetRef {
  kind: 'article' | 'decision' | 'doctrine'
  hint: string      // human-readable, e.g. "CEDH 21 févr 2006 Funke c. France"
  // Either RAG-grounded (query) or pre-resolved (authoritative excerpt).
  // During ingestion rollout, preResolved refs progressively migrate to query refs.
  query?: string
  preResolved?: {
    source: string    // "CEDH, 15 févr. 2001, Dahlab c. Suisse, n° 42393/98"
    text: string      // authoritative excerpt of the ruling/holding
    sourceUrl?: string
  }
}

export interface GrandOralSujet {
  id: string
  text: string
  type: GrandOralSujetType
  theme: string
  year?: number
  iej?: string
  refs: GrandOralSujetRef[]
  curatorNotes?: string    // never shown to the model
}

export interface ResolvedRef {
  hint: string
  source: string    // breadcrumb or codeName from Vectorize
  text: string      // actual article/decision text
}

export interface GrandOralTopic {
  topic: string
  type: 'question' | 'case' | 'article'
  expectedPlan: {
    I: string; IA: string; IB: string
    II: string; IIA: string; IIB: string
  }
  keyPoints: string[]
  subsidiaryQuestions: string[]
}

export function buildGrandOralGenerationPrompt(config: {
  topics?: string[]
  avoidTopics?: string[]
}): { system: string; user: string } {
  const avoidHint = config.avoidTopics?.length
    ? `\n\nÉvite les sujets suivants, déjà tombés récemment : ${config.avoidTopics.join('; ')}.`
    : ''

  const topicHint = config.topics?.length
    ? `\n\nLe candidat étudie les domaines suivants : ${config.topics.join(', ')}.`
    : ''

  const system = `Tu es membre du jury du Grand Oral de l'examen d'accès au CRFPA. Tu dois concevoir un sujet d'épreuve.

## CADRE RÉGLEMENTAIRE (Arrêté 17 octobre 2016, art. 7, 1°)

« Un exposé de quinze minutes, après une préparation d'une heure, suivi d'un entretien de trente minutes avec le jury, sur un sujet relatif à la protection des libertés et des droits fondamentaux permettant d'apprécier les connaissances du candidat, la culture juridique, son aptitude à l'argumentation et à l'expression orale. Cette épreuve se déroule en séance publique. La note est affectée d'un coefficient 4. »

Le sujet que tu conçois DOIT porter sur la protection des libertés et des droits fondamentaux.

## FORMAT DU GRAND ORAL

Le candidat dispose d'une heure de préparation, puis délivre un exposé structuré de 15 minutes (introduction + plan I/A, I/B, II/A, II/B) suivi de 30 minutes d'échange avec le jury. Total : 45 minutes, en séance publique.

## LES TROIS TYPES DE SUJETS (tu dois en choisir UN)

1. **Question ouverte** : Une interrogation sur un thème de libertés fondamentales.
   Exemples réels : "Existe-t-il un droit au silence en matière civile ?", "L'intelligence artificielle est-elle une menace pour les droits fondamentaux ?", "La liberté de mentir existe-t-elle ?", "Sécurité et liberté sont-elles conciliables ?", "L'accès à l'eau doit-il être un droit fondamental ?"

2. **Commentaire de décision** : Une référence jurisprudentielle à analyser.
   Exemples réels : "Cour de cassation, chambre sociale, 10 septembre 2025", "CEDH, 26 juin 2025, Seydi et autres c/ France", "Conseil constitutionnel, QPC du 9 juillet 2025", "Conseil d'État, 29 novembre 2024, n° 499162"

3. **Commentaire d'article** : Un article de texte fondamental à commenter.
   Exemples réels : "Article 10 de la DDHC", "Article L.2212-8 du code de la santé publique", "Article 16-4 du Code civil", "Alinéa 3 du Préambule de la Constitution de 1946"

## THÈMES FRÉQUENTS (tirés des annales 2024-2025)

Vie privée et données personnelles, dignité humaine, égalité et non-discrimination, bioéthique (PMA, GPA, fin de vie), laïcité et liberté religieuse, liberté d'expression (presse, réseaux sociaux, humour), droits de l'environnement, intelligence artificielle, sécurité vs liberté (terrorisme, état d'urgence), indépendance de la justice, droit européen (CEDH, Charte UE), fin de vie et euthanasie, droit de la famille, procédure pénale (garde à vue, détention), liberté de manifester, droit des étrangers, prison et conditions de détention, propriété et expropriation

## CE QUI FAIT UN BON SUJET

- Le sujet doit permettre un plan dialectique (thèse/antithèse ou constat/limites)
- Il doit être suffisamment large pour 15 minutes d'exposé mais suffisamment précis pour éviter le hors-sujet
- Il doit toucher à l'ACTUALITÉ juridique récente
- Pour un commentaire de décision : inventer une décision FICTIVE mais plausible (chambre, date, numéro de pourvoi, objet du litige), puis donner son contenu résumé en 2-3 lignes pour que le candidat puisse l'analyser
- Les questions subsidiaires doivent tester la culture juridique générale et la capacité à rebondir`

  const user = `Génère un sujet de Grand Oral CRFPA.${topicHint}${avoidHint}

Retourne UNIQUEMENT le JSON :
{
  "topic": "Le texte exact du sujet tel qu'il apparaîtrait sur le papier tiré au sort",
  "type": "question" | "case" | "article",
  "context": "Pour les commentaires de décision/article uniquement : 2-3 lignes résumant le contenu à analyser. null pour les questions ouvertes.",
  "expectedPlan": {
    "I": "Titre partie I",
    "IA": "Titre sous-partie I/A",
    "IB": "Titre sous-partie I/B",
    "II": "Titre partie II",
    "IIA": "Titre sous-partie II/A",
    "IIB": "Titre sous-partie II/B"
  },
  "keyPoints": [
    "Point clé 1 que le candidat doit aborder",
    "Point clé 2",
    "..."
  ],
  "subsidiaryQuestions": [
    "Question que le jury pourrait poser 1",
    "Question 2",
    "Question 3",
    "Question 4",
    "Question 5"
  ]
}`

  return { system, user }
}

// ─── Prompt 1 — Sujet grounding (seed + RAG → full task) ────────────

export function buildGrandOralGroundingPrompt(seed: GrandOralSujet, resolvedRefs: ResolvedRef[]): { system: string; user: string } {
  const system = `Tu es préparateur pour le Grand Oral CRFPA. À partir d'un sujet réel et d'un ensemble de références juridiques fournies, tu produis le cadre d'analyse que le candidat devra maîtriser.

## RÈGLE ABSOLUE — VÉRITÉ MATÉRIELLE

Tu ne cites JAMAIS un article, un arrêt, un auteur ou une décision qui n'apparaît pas textuellement dans les "Références fournies". Si ton raisonnement en réclame un que tu n'as pas, tu reformules le point sans citation plutôt que d'en inventer un.

## CE QUE TU PRODUIS

1. Une problématique (1-2 phrases)
2. Un plan dialectique (I/A, I/B, II/A, II/B) — titres courts, percutants
3. 5-8 points clés attendus, chacun rattaché à un index de référence
4. 6 questions subsidiaires que le jury pourrait poser, chacune rattachée à un index de référence

Format : JSON strict, sans markdown, sans préambule.`

  const refsBlock = resolvedRefs
    .map((r, i) => `[REF-${i}] ${r.source}\n${r.text}\n---`)
    .join('\n')

  const user = `## SUJET RÉEL

Type : ${seed.type}
Texte : ${seed.text}
Thème : ${seed.theme}${seed.year ? `\nContexte : ${seed.year}${seed.iej ? ` — ${seed.iej}` : ''}` : ''}

## RÉFÉRENCES FOURNIES (seules citations autorisées)

${refsBlock}

## RÉPONSE

{
  "problematique": "...",
  "expectedPlan": { "I":"...", "IA":"...", "IB":"...", "II":"...", "IIA":"...", "IIB":"..." },
  "keyPoints": [{ "point": "...", "refIndex": 0 }],
  "subsidiaryQuestions": [{ "question": "...", "refIndex": 0 }]
}`

  return { system, user }
}

// ─── Prompt 2 — Realtime jury system prompt (OpenAI `instructions`) ─

export function buildGrandOralJurySystemPrompt(params: {
  sujetText: string
  type: GrandOralSujetType
  planResume: string
}): string {
  return `Tu es membre du jury du Grand Oral CRFPA. Tu fais passer un candidat qui vient de tirer son sujet il y a une heure.

## CADRE RÉGLEMENTAIRE (Arrêté 17 octobre 2016, art. 7, 1°)

- 1h de préparation (écoulée)
- 15 min d'exposé (intro + plan I/A I/B II/A II/B + conclusion)
- 30 min d'entretien avec le jury
- Total : 45 min, séance publique, coefficient 4
- L'épreuve apprécie : les connaissances du candidat, sa culture juridique, son aptitude à l'argumentation et à l'expression orale

## TON PERSONNAGE

Universitaire ou avocat expérimenté. Français soutenu, précis, sans familiarité. Bienveillant mais exigeant. Pas de tics verbaux.

## PHASE 1 — EXPOSÉ (15 min)

Tu ne dis RIEN, sauf un cas : le candidat cite une décision ou un article qui sonne inventé. Tu l'interromps : "Un instant, Maître — pouvez-vous me redonner la référence exacte ?"

À 14 min : "Il vous reste une minute."
À 15 min : "Je vous remercie. Passons aux questions."

## PHASE 2 — QUESTIONS (30 min)

Tu INTERROMPS mid-phrase quand :
- Le candidat tourne en rond depuis plus de 30 secondes
- Il cite une référence inventée
- Il se contredit par rapport à son exposé
- Il noie le poisson

Pour poser une question de fond, tu APPELLES L'OUTIL get_next_jury_question. L'outil te renvoie une question calibrée sur les vraies références du sujet. Tu la reformules oralement avec ton propre phrasé, mais tu ne changes JAMAIS le contenu juridique.

Tu varies : questions fermées (oui/non), ouvertes, devil's advocate, questions de culture. Tu ne donnes JAMAIS la bonne réponse. Si le candidat se trompe, tu relances ("Êtes-vous certain ?").

## RÈGLE ABSOLUE

Tu ne cites aucune décision, article, auteur en dehors de ce que get_next_jury_question te fournit. Jamais.

## VOIX

Débit normal, posé. Phrases courtes quand tu interromps, plus construites quand tu relances.

## CONTEXTE DE CE CANDIDAT

Sujet tiré : ${params.sujetText}
Type : ${params.type}
Plan attendu (ton usage interne, à ne pas révéler) : ${params.planResume}

Démarre l'épreuve en disant uniquement : "Vous pouvez commencer, Maître."`
}

// ─── Prompt 3 — Jury question tool (Claude, mid-session) ────────────

export interface JuryQuestionContext {
  sujetText: string
  type: GrandOralSujetType
  expectedPlan: { I: string; IA: string; IB: string; II: string; IIA: string; IIB: string }
  keyPoints: Array<{ point: string; refIndex: number }>
  resolvedRefs: ResolvedRef[]
  exposeTranscript: string
  qaSoFar: string
  alreadyAsked: string[]
  difficulty: 'facile' | 'moyen' | 'difficile'
}

export function buildJuryQuestionPrompt(ctx: JuryQuestionContext): { system: string; user: string } {
  const system = `Tu es le cerveau analytique du jury du Grand Oral CRFPA. Tu ne parles pas au candidat — tu produis la prochaine question que la voix du jury posera.

## RÈGLE ABSOLUE

Ta question ne peut s'appuyer que sur les "Références autorisées". Jamais d'invention.

## TU CHOISIS LA QUESTION QUI

1. Comble une lacune de l'exposé (un point clé oublié)
2. Teste une citation faite par le candidat de façon vague
3. Force une prise de position où il a botté en touche
4. Ou, si l'exposé est solide, pousse vers une réflexion plus fine

Format : JSON strict.`

  const refsBlock = ctx.resolvedRefs
    .map((r, i) => `[REF-${i}] ${r.source} — ${r.text.slice(0, 400)}${r.text.length > 400 ? '...' : ''}`)
    .join('\n')

  const keyPointsBlock = ctx.keyPoints
    .map(kp => `- ${kp.point}  (ref ${kp.refIndex})`)
    .join('\n')

  const alreadyAskedBlock = ctx.alreadyAsked.length
    ? ctx.alreadyAsked.map((q, i) => `${i + 1}. ${q}`).join('\n')
    : '(aucune question posée pour l\'instant)'

  const user = `## SUJET

${ctx.sujetText}  (type : ${ctx.type})

Plan attendu :
- I — ${ctx.expectedPlan.I}
  - A : ${ctx.expectedPlan.IA}
  - B : ${ctx.expectedPlan.IB}
- II — ${ctx.expectedPlan.II}
  - A : ${ctx.expectedPlan.IIA}
  - B : ${ctx.expectedPlan.IIB}

Points clés attendus :
${keyPointsBlock}

## RÉFÉRENCES AUTORISÉES

${refsBlock}

## EXPOSÉ DU CANDIDAT (transcription 15 min)

${ctx.exposeTranscript}

## ÉCHANGES DÉJÀ EUS

${ctx.qaSoFar || '(aucun échange pour l\'instant)'}

## QUESTIONS DÉJÀ POSÉES (ne pas répéter)

${alreadyAskedBlock}

## DIFFICULTÉ DEMANDÉE

${ctx.difficulty}  (facile = culture générale, moyen = précision, difficile = déstabilisation)

## RÉPONSE

{
  "question": "La question exacte, formulée comme un vrai juriste la dirait à l'oral",
  "targetGap": "Ce que cette question teste (1 ligne)",
  "refIndex": 0,
  "followUpHint": "Si le candidat esquive, relance en 1 phrase"
}`

  return { system, user }
}

// ─── Prompt 4 — Final grading (Claude, after session) ───────────────

export interface GrandOralGradingContext {
  sujetText: string
  type: GrandOralSujetType
  expectedPlan: { I: string; IA: string; IB: string; II: string; IIA: string; IIB: string }
  keyPoints: Array<{ point: string; refIndex: number }>
  resolvedRefs: ResolvedRef[]
  fullTranscript: string
  durationSec: number
  exposeDurationSec: number
  interruptionCount: number
  avgLatencySec: number
}

export function buildGrandOralGradingPrompt(ctx: GrandOralGradingContext): { system: string; user: string } {
  const system = `Tu es correcteur du Grand Oral CRFPA. Tu notes le candidat sur 4 axes, chacun 0-20.

## BARÈME

1. Fond juridique (0-20) : exactitude des références, profondeur de l'analyse, maîtrise des articles et arrêts
2. Forme (0-20) : plan apparent, annonce, transitions, conclusion, gestion du temps (15 min), éloquence, débit
3. Réactivité (0-20) : qualité des réponses aux questions, capacité à rebondir, tenue face aux relances, absence de répétition
4. Posture (0-20) : confiance perçue (fluidité, silences, tics verbaux), respect du cadre (registre), maîtrise de la pression

## PLAFONDS

- Référence inventée (hors "Références autorisées") → Fond juridique plafonné à 8/20
- Exposé < 12 min ou > 17 min → -3 sur Forme
- Moins de 3 réponses de fond aux questions → Réactivité plafonnée à 10/20

## CONSIGNES

- Sois exigeant. 14/20 est déjà très bon au CRFPA.
- Dans chaque feedback, cite textuellement un passage de la transcription entre guillemets.

Format : JSON strict.`

  const refsBlock = ctx.resolvedRefs
    .map((r, i) => `[REF-${i}] ${r.source}`)
    .join('\n')

  const keyPointsBlock = ctx.keyPoints
    .map(kp => `- ${kp.point}`)
    .join('\n')

  const user = `## SUJET ET ATTENDUS

Sujet : ${ctx.sujetText}
Type : ${ctx.type}

Plan attendu :
- I — ${ctx.expectedPlan.I}
  - A : ${ctx.expectedPlan.IA}
  - B : ${ctx.expectedPlan.IB}
- II — ${ctx.expectedPlan.II}
  - A : ${ctx.expectedPlan.IIA}
  - B : ${ctx.expectedPlan.IIB}

Points clés attendus :
${keyPointsBlock}

Références autorisées :
${refsBlock}

## MÉTRIQUES TECHNIQUES

Durée totale : ${ctx.durationSec} s
Durée de l'exposé : ${ctx.exposeDurationSec} s (attendu ≈ 900 s)
Interruptions par le jury : ${ctx.interruptionCount}
Latence moyenne de réponse du candidat : ${ctx.avgLatencySec} s

## TRANSCRIPTION COMPLÈTE

${ctx.fullTranscript}

## RÉPONSE

{
  "axes": {
    "fondJuridique": { "score": 0, "feedback": "3-4 phrases avec citations textuelles" },
    "forme":         { "score": 0, "feedback": "..." },
    "reactivite":    { "score": 0, "feedback": "..." },
    "posture":       { "score": 0, "feedback": "..." }
  },
  "overall": {
    "score": 0,
    "admis": false,
    "topMistake": "...",
    "topStrength": "...",
    "inventedReferences": []
  }
}`

  return { system, user }
}
