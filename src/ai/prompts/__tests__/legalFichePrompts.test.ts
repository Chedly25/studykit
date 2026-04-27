import { describe, it, expect } from 'vitest'
import {
  buildLegalFicheGenerationPrompt,
  buildLegalFicheVerificationPrompt,
  buildLegalFicheActualitePrompt,
  FICHE_THEMES,
  TAVILY_DOMAINS,
  TAVILY_ALL_DOMAINS,
  ACTUALITE_MARKER,
  findThemeById,
} from '../legalFichePrompts'
import type {
  LegalFicheGenerationConfig,
  LegalFicheVerificationConfig,
  LegalFicheActualiteConfig,
  LegalFicheUserCoursChunk,
  LegalFicheActualiteTavilyResult,
} from '../legalFichePrompts'
import type { CasPratiqueGroundingEntry } from '../../coaching/types'

const SAMPLE_POOL: CasPratiqueGroundingEntry[] = [
  {
    articleNum: '1231-1',
    codeName: 'Code civil',
    breadcrumb: 'Livre III, Titre III, Chapitre IV',
    text: 'Le débiteur est condamné, s\'il y a lieu, au paiement de dommages-intérêts soit à raison de l\'inexécution de l\'obligation, soit à raison du retard dans l\'exécution...',
  },
  {
    articleNum: '1240',
    codeName: 'Code civil',
    breadcrumb: 'Livre III, Titre III',
    text: 'Tout fait quelconque de l\'homme, qui cause à autrui un dommage, oblige celui par la faute duquel il est arrivé à le réparer.',
  },
  {
    articleNum: '89-15.231',
    codeName: 'Jurisprudence — Cour de cassation, Assemblée plénière',
    breadcrumb: '29 mars 1991, Blieck',
    text: 'La présomption de responsabilité du fait des choses s\'étend aux personnes dont on répond...',
  },
]

const SAMPLE_COURS: LegalFicheUserCoursChunk[] = [
  {
    chunkId: 'chunk-a',
    documentTitle: 'Cours M. Dupont — Obligations',
    content: 'Dans notre cours, nous avons vu que la responsabilité contractuelle suppose trois conditions cumulatives : l\'inexécution, le dommage et le lien de causalité.',
  },
]

function makeGenConfig(
  overrides: Partial<LegalFicheGenerationConfig> = {},
): LegalFicheGenerationConfig {
  return {
    theme: 'Responsabilité contractuelle',
    matiere: 'obligations',
    groundingPool: SAMPLE_POOL,
    userCoursChunks: [],
    ...overrides,
  }
}

function makeVerifyConfig(
  overrides: Partial<LegalFicheVerificationConfig> = {},
): LegalFicheVerificationConfig {
  return {
    groundingPool: SAMPLE_POOL,
    userCoursChunks: [],
    ficheMarkdown: '# Responsabilité contractuelle\n\n## Cadre\n\nLa responsabilité contractuelle...',
    ...overrides,
  }
}

describe('buildLegalFicheGenerationPrompt', () => {
  it('returns system and user strings', () => {
    const result = buildLegalFicheGenerationPrompt(makeGenConfig())
    expect(typeof result.system).toBe('string')
    expect(typeof result.user).toBe('string')
    expect(result.system.length).toBeGreaterThan(500)
  })

  it('includes the CRFPA framing', () => {
    const result = buildLegalFicheGenerationPrompt(makeGenConfig())
    expect(result.system).toContain('CRFPA')
    expect(result.system).toContain('wall-worthy')
  })

  it('mandates pourvoi numbers for arrêts', () => {
    const result = buildLegalFicheGenerationPrompt(makeGenConfig())
    expect(result.system).toContain('pourvoi')
    expect(result.system).toContain('OBLIGATOIRES')
  })

  it('mandates chamber specification', () => {
    const result = buildLegalFicheGenerationPrompt(makeGenConfig())
    expect(result.system.toLowerCase()).toContain('chambre')
    expect(result.system).toContain('Ass. plén.')
  })

  it('enforces [nouv.]/[anc.] flagging for post-reform articles', () => {
    const result = buildLegalFicheGenerationPrompt(makeGenConfig())
    expect(result.system).toContain('[nouv.]')
    expect(result.system).toContain('[anc.]')
  })

  it('forbids emojis and tutoiement', () => {
    const result = buildLegalFicheGenerationPrompt(makeGenConfig())
    expect(result.system).toContain('AUCUN emoji')
    expect(result.system).toContain('AUCUN tutoiement')
  })

  it('explicitly excludes a Mnémotechniques section', () => {
    const result = buildLegalFicheGenerationPrompt(makeGenConfig())
    expect(result.system).toContain('PAS de section "Mnémotechniques"')
  })

  it('includes the full canonical skeleton', () => {
    const result = buildLegalFicheGenerationPrompt(makeGenConfig())
    // All 12 sections present
    const requiredSections = [
      '## Cadre',
      '## Définition',
      '## Textes fondamentaux',
      '## Jurisprudence',
      '### Arrêts de principe',
      '### Confirmations',
      '### Revirements',
      '## Régime juridique',
      '### Conditions',
      '### Mise en œuvre',
      '### Effets',
      '### Exceptions',
      '## Distinctions',
      '## Controverses doctrinales',
      '## Pièges classiques',
      '## Méthodologie CRFPA',
      '## Voir aussi',
    ]
    for (const s of requiredSections) {
      expect(result.system).toContain(s)
    }
  })

  it('injects the grounding pool into the user prompt', () => {
    const result = buildLegalFicheGenerationPrompt(makeGenConfig())
    expect(result.user).toContain('1231-1')
    expect(result.user).toContain('1240')
    expect(result.user).toContain('Code civil')
    expect(result.user).toContain('Blieck')
  })

  it('when cours provided, injects them with source title', () => {
    const result = buildLegalFicheGenerationPrompt(makeGenConfig({ userCoursChunks: SAMPLE_COURS }))
    expect(result.user).toContain('Cours M. Dupont')
    expect(result.user).toContain('trois conditions cumulatives')
  })

  it('when no cours, provides explicit guidance', () => {
    const result = buildLegalFicheGenerationPrompt(makeGenConfig())
    expect(result.user).toContain('téléversé')
  })

  it('surfaces previousFailures for retry', () => {
    const result = buildLegalFicheGenerationPrompt(makeGenConfig({
      previousFailures: ['Art. 1131 inventé', 'Cass. 12 mars 2019 fictif'],
    }))
    expect(result.system).toContain('Art. 1131 inventé')
    expect(result.system).toContain('Cass. 12 mars 2019 fictif')
    expect(result.system).toContain('CORRECTIONS À APPORTER')
  })

  it('supports custom query framing', () => {
    const result = buildLegalFicheGenerationPrompt(makeGenConfig({
      customQuery: 'fiche sur le dol dans la formation du contrat',
    }))
    expect(result.user).toContain('dol dans la formation du contrat')
  })

  it('matiere surfaces in the user prompt', () => {
    const result = buildLegalFicheGenerationPrompt(makeGenConfig({ matiere: 'social' }))
    expect(result.user).toContain('social')
  })

  it('targets 2500-4000 words', () => {
    const result = buildLegalFicheGenerationPrompt(makeGenConfig())
    expect(result.system).toContain('2 500')
    expect(result.system).toContain('4 000')
  })

  it('opens fiche with # {Thème} directive', () => {
    const result = buildLegalFicheGenerationPrompt(makeGenConfig())
    expect(result.user).toContain('# Responsabilité contractuelle')
  })

  it('specifies 100-word cap on verbatim cours quotes', () => {
    const result = buildLegalFicheGenerationPrompt(makeGenConfig())
    expect(result.system).toContain('100 mots')
    expect(result.system).toContain('paraphrase')
  })

  it('instructs model to emit ACTUALITE_WEB_PENDING marker when pool lacks recent jurisprudence', () => {
    const result = buildLegalFicheGenerationPrompt(makeGenConfig())
    expect(result.system).toContain('ACTUALITE_WEB_PENDING')
    expect(result.system).toContain('18 mois')
  })

  it('forbids inventing recent arrêts to fill Actualité', () => {
    const result = buildLegalFicheGenerationPrompt(makeGenConfig())
    expect(result.system).toContain('N\'invente JAMAIS d\'arrêts récents')
  })
})

describe('buildLegalFicheVerificationPrompt', () => {
  it('returns system and user strings', () => {
    const result = buildLegalFicheVerificationPrompt(makeVerifyConfig())
    expect(typeof result.system).toBe('string')
    expect(typeof result.user).toBe('string')
  })

  it('requires JSON-only output', () => {
    const result = buildLegalFicheVerificationPrompt(makeVerifyConfig())
    expect(result.system).toContain('UNIQUEMENT du JSON')
  })

  it('defines the three severity levels', () => {
    const result = buildLegalFicheVerificationPrompt(makeVerifyConfig())
    expect(result.system).toContain('invented')
    expect(result.system).toContain('misrepresented')
    expect(result.system).toContain('cours-fabricated')
  })

  it('exposes the pool to the verifier', () => {
    const result = buildLegalFicheVerificationPrompt(makeVerifyConfig())
    expect(result.user).toContain('1231-1')
    expect(result.user).toContain('1240')
  })

  it('exposes the fiche markdown to the verifier', () => {
    const result = buildLegalFicheVerificationPrompt(makeVerifyConfig({
      ficheMarkdown: '# UNIQUE_MARKER\n\nhello',
    }))
    expect(result.user).toContain('UNIQUE_MARKER')
  })

  it('handles empty cours case', () => {
    const result = buildLegalFicheVerificationPrompt(makeVerifyConfig())
    expect(result.user).toContain('aucun cours')
  })

  it('handles non-empty cours case', () => {
    const result = buildLegalFicheVerificationPrompt(makeVerifyConfig({
      userCoursChunks: SAMPLE_COURS,
    }))
    expect(result.user).toContain('Cours M. Dupont')
    expect(result.user).toContain('trois conditions cumulatives')
  })
})

describe('FICHE_THEMES', () => {
  it('has at least 30 themes', () => {
    expect(FICHE_THEMES.length).toBeGreaterThanOrEqual(30)
  })

  it('covers every matière declared in the enum', () => {
    const matieres = new Set(FICHE_THEMES.map(t => t.matiere))
    expect(matieres.has('obligations')).toBe(true)
    expect(matieres.has('civil')).toBe(true)
    expect(matieres.has('penal')).toBe(true)
    expect(matieres.has('affaires')).toBe(true)
    expect(matieres.has('social')).toBe(true)
    expect(matieres.has('administratif')).toBe(true)
    expect(matieres.has('fiscal')).toBe(true)
    expect(matieres.has('immobilier')).toBe(true)
    expect(matieres.has('procedure-civile')).toBe(true)
    expect(matieres.has('procedure-penale')).toBe(true)
    expect(matieres.has('procedure-administrative')).toBe(true)
    expect(matieres.has('libertes')).toBe(true)
  })

  it('each theme has id, label, matiere, and searchSeeds', () => {
    for (const theme of FICHE_THEMES) {
      expect(theme.id).toBeTruthy()
      expect(theme.label).toBeTruthy()
      expect(theme.matiere).toBeTruthy()
      expect(theme.searchSeeds.length).toBeGreaterThanOrEqual(1)
      for (const seed of theme.searchSeeds) {
        expect(typeof seed).toBe('string')
        expect(seed.length).toBeGreaterThan(5)
      }
    }
  })

  it('theme ids are unique', () => {
    const ids = FICHE_THEMES.map(t => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('obligations is heavy (core écrit matière)', () => {
    const obligations = FICHE_THEMES.filter(t => t.matiere === 'obligations')
    expect(obligations.length).toBeGreaterThanOrEqual(5)
  })
})

describe('TAVILY_DOMAINS', () => {
  it('covers every matière', () => {
    for (const theme of FICHE_THEMES) {
      expect(TAVILY_DOMAINS[theme.matiere]).toBeDefined()
      expect(TAVILY_DOMAINS[theme.matiere].length).toBeGreaterThanOrEqual(2)
    }
  })

  it('every entry is a bare domain (no protocol, no path)', () => {
    for (const domains of Object.values(TAVILY_DOMAINS)) {
      for (const d of domains) {
        expect(d).not.toContain('://')
        expect(d).not.toContain('/')
        expect(d).toMatch(/^[a-z0-9.-]+\.[a-z]{2,}$/)
      }
    }
  })

  it('does NOT include commentary-heavy sources by default', () => {
    const union = new Set(TAVILY_ALL_DOMAINS)
    expect(union.has('village-justice.com')).toBe(false)
    expect(union.has('doc-du-juriste.com')).toBe(false)
    expect(union.has('fiches-droit.com')).toBe(false)
  })

  it('libertes scope includes ECHR', () => {
    expect(TAVILY_DOMAINS.libertes).toContain('echr.coe.int')
  })

  it('fiscal scope includes impots.gouv.fr', () => {
    expect(TAVILY_DOMAINS.fiscal).toContain('impots.gouv.fr')
  })
})

describe('ACTUALITE_MARKER', () => {
  it('is a stable HTML comment literal', () => {
    expect(ACTUALITE_MARKER).toBe('<!-- ACTUALITE_WEB_PENDING -->')
  })
})

describe('buildLegalFicheActualitePrompt', () => {
  const sampleResults: LegalFicheActualiteTavilyResult[] = [
    {
      url: 'https://www.courdecassation.fr/decision/65abc',
      title: 'Cass. 1re civ., 15 nov. 2024',
      content: 'Arrêt sur la responsabilité contractuelle confirmant la portée de Faurecia 2...',
      publishedDate: '2024-11-15',
    },
    {
      url: 'https://www.dalloz-actualite.fr/flash/some-arret',
      title: 'Dalloz Actu — commentaire',
      content: 'Commentaire doctrinal de l\'arrêt...',
      publishedDate: '2024-11-20',
    },
  ]

  function makeActualiteConfig(
    overrides: Partial<LegalFicheActualiteConfig> = {},
  ): LegalFicheActualiteConfig {
    return {
      theme: 'Responsabilité contractuelle',
      matiere: 'obligations',
      tavilyResults: sampleResults,
      ...overrides,
    }
  }

  it('returns system and user strings', () => {
    const result = buildLegalFicheActualitePrompt(makeActualiteConfig())
    expect(typeof result.system).toBe('string')
    expect(typeof result.user).toBe('string')
    expect(result.system.length).toBeGreaterThan(200)
  })

  it('lists the allowed domains for the matière in the system prompt', () => {
    const result = buildLegalFicheActualitePrompt(makeActualiteConfig({ matiere: 'social' }))
    expect(result.system).toContain('travail-emploi.gouv.fr')
  })

  it('forbids URLs outside the allowlist', () => {
    const result = buildLegalFicheActualitePrompt(makeActualiteConfig())
    expect(result.system).toContain('INTERDITE')
  })

  it('demands 2-4 entries', () => {
    const result = buildLegalFicheActualitePrompt(makeActualiteConfig())
    expect(result.system).toContain('2 et 4 entrées')
  })

  it('requires each entry to include a source URL', () => {
    const result = buildLegalFicheActualitePrompt(makeActualiteConfig())
    expect(result.system).toContain('([source](URL))')
  })

  it('forbids an ### Actualité heading in the output', () => {
    const result = buildLegalFicheActualitePrompt(makeActualiteConfig())
    expect(result.system).toContain('PAS d\'en-tête')
  })

  it('provides explicit fallback line when no extracts are usable', () => {
    const result = buildLegalFicheActualitePrompt(makeActualiteConfig())
    expect(result.system).toContain('Aucune actualité récente identifiable')
  })

  it('injects the Tavily results into the user prompt', () => {
    const result = buildLegalFicheActualitePrompt(makeActualiteConfig())
    expect(result.user).toContain('Faurecia 2')
    expect(result.user).toContain('https://www.courdecassation.fr/decision/65abc')
  })

  it('handles empty results gracefully', () => {
    const result = buildLegalFicheActualitePrompt(makeActualiteConfig({ tavilyResults: [] }))
    expect(result.user).toContain('aucun résultat')
  })

  it('includes theme and matière in the user prompt', () => {
    const result = buildLegalFicheActualitePrompt(makeActualiteConfig())
    expect(result.user).toContain('Responsabilité contractuelle')
    expect(result.user).toContain('obligations')
  })

  it('no emojis in the prompt', () => {
    const result = buildLegalFicheActualitePrompt(makeActualiteConfig())
    expect(result.system).toContain('Aucun emoji')
  })
})

describe('findThemeById', () => {
  it('returns a theme when id exists', () => {
    const theme = findThemeById('vices-consentement')
    expect(theme).toBeDefined()
    expect(theme?.label).toContain('consentement')
  })

  it('returns undefined for unknown id', () => {
    expect(findThemeById('does-not-exist')).toBeUndefined()
  })
})
