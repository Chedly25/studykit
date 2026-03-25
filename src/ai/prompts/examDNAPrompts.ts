/**
 * Prompts for Exam DNA analysis — extracts style fingerprint from real past papers.
 */

export interface DNAProfile {
  structure: {
    partCount: number
    questionsPerPart: number[]
    totalQuestions: number
    hasPreambule: boolean
    hasTheoremTarget: boolean
    hasNavigationParagraph: boolean
  }
  questionTypes: Record<string, number>  // type → proportion (0-1)
  difficulty: {
    curveShape: string
    scaffoldingLevel: 'low' | 'moderate' | 'high'
    hintsCount: number
    questionsWithoutHints: number
    questionsWhereStudentFindsResult: number
  }
  content: {
    primaryDomain: string
    secondaryDomains: string[]
    crossDomainIntegration: 'none' | 'light' | 'moderate' | 'essential'
    theoremLevel: 'program' | 'advanced-program' | 'research'
    notationDensity: 'low' | 'moderate' | 'high'
    customNotations: string[]
  }
  style: {
    proseDensity: 'sparse' | 'moderate' | 'dense'
    formalityLevel: 'standard' | 'formal' | 'very-formal'
    subpartUsage: 'none' | 'rare' | 'frequent'
    samplePatterns: string[]
  }
}

export function buildDNAAnalysisPrompt(examText: string): { system: string; user: string } {
  const system = `Tu es un analyste expert des épreuves de concours français (CPGE, CRFPA, médecine). On te donne le texte complet d'une épreuve. Tu dois analyser sa structure, son style et ses patterns avec précision.

Retourne UNIQUEMENT un JSON valide, sans texte autour.`

  const user = `TEXTE COMPLET DE L'ÉPREUVE :

${examText}

---

Analyse cette épreuve et produis un profil ADN (DNA) au format JSON :

{
  "structure": {
    "partCount": <nombre de parties>,
    "questionsPerPart": [<questions dans partie 1>, <partie 2>, ...],
    "totalQuestions": <total>,
    "hasPreambule": <true si préambule avec notations/définitions>,
    "hasTheoremTarget": <true si le sujet vise à démontrer un théorème annoncé>,
    "hasNavigationParagraph": <true si paragraphe décrivant les parties>
  },
  "questionTypes": {
    "montrerQue": <proportion 0-1>,
    "enDeduire": <proportion>,
    "calculer": <proportion>,
    "determiner": <proportion>,
    "justifier": <proportion>,
    "conclure": <proportion>,
    "openEnded": <proportion de questions sans résultat donné>
  },
  "difficulty": {
    "curveShape": "<description: gradual-escalation, gradual-then-spike, flat, etc.>",
    "scaffoldingLevel": "<low|moderate|high>",
    "hintsCount": <nombre de 'On pourra utiliser...' ou indications similaires>,
    "questionsWithoutHints": <nombre de questions sans aucune indication>,
    "questionsWhereStudentFindsResult": <nombre de questions où le résultat n'est pas donné>
  },
  "content": {
    "primaryDomain": "<domaine principal>",
    "secondaryDomains": ["<domaine secondaire 1>", ...],
    "crossDomainIntegration": "<none|light|moderate|essential>",
    "theoremLevel": "<program|advanced-program|research>",
    "notationDensity": "<low|moderate|high>",
    "customNotations": ["<notation originale 1>", "<notation 2>", ...]
  },
  "style": {
    "proseDensity": "<sparse|moderate|dense>",
    "formalityLevel": "<standard|formal|very-formal>",
    "subpartUsage": "<none|rare|frequent>",
    "samplePatterns": [
      "<copier-coller 3-5 questions représentatives du style, verbatim>"
    ]
  }
}`

  return { system, user }
}

/**
 * Build the DNA-enhanced prompt block that replaces the generic concours profile.
 */
export function buildDNAProfileBlock(dna: DNAProfile, paperCount: number): string {
  const qtypes = Object.entries(dna.questionTypes)
    .filter(([, v]) => v > 0.03)
    .sort(([, a], [, b]) => b - a)
    .map(([type, pct]) => {
      const labels: Record<string, string> = {
        montrerQue: '"Montrer que..." (résultat donné)',
        enDeduire: '"En déduire..." (suite logique)',
        calculer: '"Calculer..." (calcul explicite)',
        determiner: '"Déterminer..." (résultat à trouver)',
        justifier: '"Justifier..."',
        conclure: '"Conclure."',
        openEnded: 'Questions ouvertes sans indication',
      }
      return `  - ${Math.round(pct * 100)}% ${labels[type] ?? type}`
    })
    .join('\n')

  const domains = [dna.content.primaryDomain, ...dna.content.secondaryDomains].filter(Boolean).join(', ')

  const patterns = dna.style.samplePatterns.length > 0
    ? `\nPatterns réels extraits des sujets :\n${dna.style.samplePatterns.map(p => `  - "${p}"`).join('\n')}`
    : ''

  return `## PROFIL ADN DE L'ÉPREUVE (analysé à partir de ${paperCount} sujets réels)

Structure : ${dna.structure.partCount} parties, ~${dna.structure.totalQuestions} questions
${dna.structure.hasPreambule ? 'Préambule avec notations et définitions' : 'Pas de préambule formel'}
${dna.structure.hasTheoremTarget ? 'Théorème cible annoncé en début de sujet' : 'Pas de théorème cible explicite'}
${dna.structure.hasNavigationParagraph ? 'Paragraphe de navigation décrivant les parties' : ''}

Distribution des questions :
${qtypes}

Difficulté : ${dna.difficulty.curveShape}
Scaffolding : ${dna.difficulty.scaffoldingLevel} (${dna.difficulty.hintsCount} indications "On pourra utiliser..." max)
${dna.difficulty.questionsWithoutHints} questions sans aucune indication
${dna.difficulty.questionsWhereStudentFindsResult} questions où le candidat doit trouver le résultat

Domaines : ${domains}
Intégration inter-domaines : ${dna.content.crossDomainIntegration}
Niveau du théorème cible : ${dna.content.theoremLevel}
Densité de notations : ${dna.content.notationDensity}${dna.content.customNotations.length > 0 ? `\nNotations originales : ${dna.content.customNotations.join(', ')}` : ''}

Style : prose ${dna.style.proseDensity}, formalité ${dna.style.formalityLevel}
Sous-parties a), b), c) : ${dna.style.subpartUsage}${patterns}`
}

/**
 * Merge multiple DNA profiles into one aggregate.
 */
export function mergeDNAProfiles(profiles: DNAProfile[]): DNAProfile {
  if (profiles.length === 0) throw new Error('No profiles to merge')
  if (profiles.length === 1) return profiles[0]

  const avg = (nums: number[]) => nums.reduce((s, n) => s + n, 0) / nums.length
  const mode = <T>(arr: T[]): T => {
    const counts = new Map<T, number>()
    for (const v of arr) counts.set(v, (counts.get(v) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]
  }

  // Average question type distributions
  const allTypes = new Set(profiles.flatMap(p => Object.keys(p.questionTypes)))
  const avgTypes: Record<string, number> = {}
  for (const type of allTypes) {
    avgTypes[type] = avg(profiles.map(p => p.questionTypes[type] ?? 0))
  }

  // Collect all sample patterns (deduplicate, take top 8)
  const allPatterns = [...new Set(profiles.flatMap(p => p.style.samplePatterns))]

  // Collect all custom notations
  const allNotations = [...new Set(profiles.flatMap(p => p.content.customNotations))]

  // Collect all secondary domains
  const allSecondary = [...new Set(profiles.flatMap(p => p.content.secondaryDomains))]

  return {
    structure: {
      partCount: Math.round(avg(profiles.map(p => p.structure.partCount))),
      questionsPerPart: profiles[0].structure.questionsPerPart, // use first as template
      totalQuestions: Math.round(avg(profiles.map(p => p.structure.totalQuestions))),
      hasPreambule: profiles.filter(p => p.structure.hasPreambule).length > profiles.length / 2,
      hasTheoremTarget: profiles.filter(p => p.structure.hasTheoremTarget).length > profiles.length / 2,
      hasNavigationParagraph: profiles.filter(p => p.structure.hasNavigationParagraph).length > profiles.length / 2,
    },
    questionTypes: avgTypes,
    difficulty: {
      curveShape: mode(profiles.map(p => p.difficulty.curveShape)),
      scaffoldingLevel: mode(profiles.map(p => p.difficulty.scaffoldingLevel)),
      hintsCount: Math.round(avg(profiles.map(p => p.difficulty.hintsCount))),
      questionsWithoutHints: Math.round(avg(profiles.map(p => p.difficulty.questionsWithoutHints))),
      questionsWhereStudentFindsResult: Math.round(avg(profiles.map(p => p.difficulty.questionsWhereStudentFindsResult))),
    },
    content: {
      primaryDomain: mode(profiles.map(p => p.content.primaryDomain)),
      secondaryDomains: allSecondary,
      crossDomainIntegration: mode(profiles.map(p => p.content.crossDomainIntegration)),
      theoremLevel: mode(profiles.map(p => p.content.theoremLevel)),
      notationDensity: mode(profiles.map(p => p.content.notationDensity)),
      customNotations: allNotations.slice(0, 10),
    },
    style: {
      proseDensity: mode(profiles.map(p => p.style.proseDensity)),
      formalityLevel: mode(profiles.map(p => p.style.formalityLevel)),
      subpartUsage: mode(profiles.map(p => p.style.subpartUsage)),
      samplePatterns: allPatterns.slice(0, 8),
    },
  }
}
