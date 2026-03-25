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

## FORMAT DU GRAND ORAL

Le Grand Oral porte sur les libertés et droits fondamentaux. Le candidat dispose d'une heure de préparation, puis délivre un exposé structuré de 15 minutes (introduction + plan I/A, I/B, II/A, II/B) suivi de 30 minutes d'échange avec le jury.

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
