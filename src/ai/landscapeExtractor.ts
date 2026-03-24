/**
 * AI function: extract topics from free text, pasted content, or descriptions.
 * Returns the same ExtractionResult format as topicExtractor.ts for consistency.
 */
import { streamChat } from './client'
import { createStreamExtractor } from './streamJsonExtractor'
import type { ExtractionResult, ExtractedSubject, ExtractedChapter } from './topicExtractor'

export async function extractLandscapeFromText(
  text: string,
  profileName: string,
  examType: string,
  authToken: string,
  signal?: AbortSignal,
): Promise<ExtractionResult> {
  const prompt = `Analyze this content and extract a structured subject/topic breakdown for a study project called "${profileName}" (type: ${examType}).

Content:
${text.slice(0, 8000)}

Return ONLY valid JSON matching this exact schema (3-level hierarchy: Subject > Chapter > Topic):
{
  "examName": "${profileName}",
  "subjects": [
    {
      "name": "Subject Name",
      "weight": 30,
      "chapters": [
        {
          "name": "Chapter Name",
          "topics": [
            { "name": "Topic Name" }
          ]
        }
      ]
    }
  ]
}

Rules:
- 2-6 subjects
- 2-8 chapters per subject (major sections/units)
- 2-10 topics per chapter (specific concepts/skills)
- Topics should be specific enough to study independently
- Weights should estimate relative importance and sum to 100
- Use clear, concise names
- If the content is vague, infer reasonable structure from domain knowledge`

  const response = await streamChat({
    messages: [{ role: 'user', content: prompt }],
    system: 'You are a curriculum analysis expert. Extract a 3-level hierarchy: subjects > chapters > topics. IMPORTANT: Return only valid JSON with English key names (subjects, chapters, topics, name, weight) even if the content is in another language. Names can be in the original language.',
    tools: [],
    authToken,
    maxTokens: 16384,
    signal,
  })

  const responseText = response.content
    .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
    .map(c => c.text)
    .join('')
    .replace(/```json\s*/g, '')
    .replace(/```\s*/g, '')

  const jsonMatch = responseText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Failed to parse extraction response')

  const parsed = JSON.parse(jsonMatch[0])

  // Handle French key names
  const subjects: ExtractionResult['subjects'] =
    parsed.subjects ?? parsed.matières ?? parsed.matieres ?? parsed.sujets ?? []

  if (!Array.isArray(subjects) || subjects.length === 0) {
    throw new Error('Invalid extraction result: no subjects found')
  }

  // Normalize keys and handle 3-level hierarchy
  for (const s of subjects) {
    const raw = s as unknown as Record<string, unknown>
    if (!s.chapters && raw.chapitres) s.chapters = raw.chapitres as ExtractedSubject['chapters']
    if (s.chapters && Array.isArray(s.chapters) && s.chapters.length > 0) {
      s.topics = s.chapters.flatMap(ch => ch.topics ?? [])
    }
    if (!s.chapters || s.chapters.length === 0) {
      if (!s.topics && raw.sujets) s.topics = raw.sujets as ExtractedSubject['topics']
      if (s.topics && s.topics.length > 0) {
        s.chapters = [{ name: 'General', topics: s.topics }]
      }
    }
    if (!s.topics) s.topics = []
  }

  return { ...parsed, subjects } as ExtractionResult
}

/** Streaming variant — emits subjects one-by-one via onSubject callback. */
export async function extractLandscapeFromTextStreaming(
  text: string,
  profileName: string,
  examType: string,
  authToken: string,
  onSubject: (subject: ExtractedSubject, index: number) => void,
  onStatus?: (message: string) => void,
  signal?: AbortSignal,
): Promise<ExtractionResult> {
  onStatus?.('Analyzing content...')

  const prompt = `Analyze this content and extract a structured subject/topic breakdown for a study project called "${profileName}" (type: ${examType}).

Content:
${text.slice(0, 8000)}

Return ONLY valid JSON matching this exact schema (3-level hierarchy: Subject > Chapter > Topic):
{
  "examName": "${profileName}",
  "subjects": [
    {
      "name": "Subject Name",
      "weight": 30,
      "chapters": [
        {
          "name": "Chapter Name",
          "topics": [
            { "name": "Topic Name" }
          ]
        }
      ]
    }
  ]
}

Rules:
- 2-6 subjects
- 2-8 chapters per subject (major sections/units)
- 2-10 topics per chapter (specific concepts/skills)
- Topics should be specific enough to study independently
- Weights should estimate relative importance and sum to 100
- Use clear, concise names
- If the content is vague, infer reasonable structure from domain knowledge`

  const extractor = createStreamExtractor<ExtractedSubject>('subjects', { onItem: onSubject })

  const response = await streamChat({
    messages: [{ role: 'user', content: prompt }],
    system: 'You are a curriculum analysis expert. Extract a 3-level hierarchy: subjects > chapters > topics. IMPORTANT: Return only valid JSON with English key names (subjects, chapters, topics, name, weight) even if the content is in another language. Names can be in the original language.',
    tools: [],
    authToken,
    maxTokens: 16384,
    onToken: extractor.feed,
    signal,
  })

  const subjects = extractor.finalize()

  // Extract examName from full response
  const responseText = response.content
    .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
    .map(c => c.text)
    .join('')

  let examName = profileName
  try {
    const clean = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '')
    const jsonMatch = clean.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      if (parsed.examName) examName = parsed.examName
    }
  } catch {
    // Use profile name as fallback
  }

  if (subjects.length === 0) {
    throw new Error('Invalid extraction result: no subjects found')
  }

  return { subjects, examName }
}

// ─── Known exam patterns ────────────────────────────────

const KNOWN_EXAM_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  // US exams
  { pattern: /bar\s*(exam)?/i, label: 'Bar Exam' },
  { pattern: /\bmcat\b/i, label: 'MCAT' },
  { pattern: /\blsat\b/i, label: 'LSAT' },
  { pattern: /\bgre\b/i, label: 'GRE' },
  { pattern: /\bgmat\b/i, label: 'GMAT' },
  { pattern: /\bcpa\b/i, label: 'CPA Exam' },
  { pattern: /\bcfa\b/i, label: 'CFA' },
  { pattern: /\busmle\b/i, label: 'USMLE' },
  { pattern: /\bnclex\b/i, label: 'NCLEX' },
  { pattern: /\bpe\s*exam\b/i, label: 'PE Exam' },
  { pattern: /\bfe\s*exam\b/i, label: 'FE Exam' },
  { pattern: /\bap\s+\w/i, label: 'AP Exam' },
  // Language exams
  { pattern: /\bdelf\b/i, label: 'DELF' },
  { pattern: /\bdalf\b/i, label: 'DALF' },
  { pattern: /\btoefl\b/i, label: 'TOEFL' },
  { pattern: /\bielts\b/i, label: 'IELTS' },
  { pattern: /\btoeic\b/i, label: 'TOEIC' },
  { pattern: /\bhsk\b/i, label: 'HSK' },
  { pattern: /\bjlpt\b/i, label: 'JLPT' },
  // French exams — Baccalauréat
  { pattern: /\bbac(calauréat|calaureat)?\b/i, label: 'Baccalauréat' },
  { pattern: /\bbac\s*(s|es|l|stmg|sti2d|st2s|pro)\b/i, label: 'Baccalauréat' },
  // French exams — Concours & grandes écoles
  { pattern: /concours\s*(commun|communs)?\s*(mines|centrale|ccp|e3a|x|polytechnique)/i, label: 'Concours Grandes Écoles' },
  { pattern: /\bcpge\b|prépa\s*(hec|scientifique|littéraire|litteraire|ecs|ece|ecg|mpsi|pcsi|mp|pc|psi)/i, label: 'CPGE' },
  { pattern: /concours\s*(sciences\s*po|iep)/i, label: 'Concours Sciences Po' },
  { pattern: /concours\s*(médecine|medecine|pass|las|paces)/i, label: 'Concours Médecine' },
  { pattern: /\b(pass|las)\b/i, label: 'PASS/LAS Médecine' },
  // French exams — Professional & legal
  { pattern: /\bcrfpa\b|examen\s*d['']?(accès|acces)\s*(au\s*)?barreau/i, label: 'CRFPA (Examen du Barreau)' },
  { pattern: /\benm\b|école\s*nationale\s*(de\s*la\s*)?magistrature/i, label: 'Concours ENM' },
  { pattern: /\bdscg\b/i, label: 'DSCG' },
  { pattern: /\bdcg\b/i, label: 'DCG' },
  { pattern: /\bdec\b.*comptab|expert[- ]comptable/i, label: 'DEC (Expert-Comptable)' },
  // French exams — Medical & health
  { pattern: /\becn\b|edn|examen\s*(national\s*)?(classant|dénominalisant)/i, label: 'ECN/EDN Médecine' },
  // French exams — Civil service
  { pattern: /concours\s*(administratif|fonction\s*publique|ena|insp)/i, label: 'Concours Fonction Publique' },
  { pattern: /\binsp\b|institut\s*national\s*du\s*service\s*public/i, label: 'Concours INSP (ex-ENA)' },
  { pattern: /\bcapes\b/i, label: 'CAPES' },
  { pattern: /\bagrégation\b|\bagregation\b|\bagreg\b/i, label: 'Agrégation' },
  { pattern: /\bcapeps\b/i, label: 'CAPEPS' },
  { pattern: /\bcapet\b/i, label: 'CAPET' },
  // French exams — BTS & DUT
  { pattern: /\bbts\b/i, label: 'BTS' },
  { pattern: /\bbut\b|dut\b/i, label: 'BUT/DUT' },
  // French exams — Brevet
  { pattern: /\bbrevet\b|dnb\b/i, label: 'Brevet des Collèges' },
]

/**
 * Generate topic tree for well-known exams using LLM general knowledge.
 * Returns null if the exam is unknown or too specific.
 */
export async function generateKnownExamLandscape(
  examName: string,
  jurisdiction?: string,
  authToken?: string,
): Promise<ExtractionResult | null> {
  // Check if this is a known exam
  const isKnown = KNOWN_EXAM_PATTERNS.some(p => p.pattern.test(examName))
  if (!isKnown) return null
  if (!authToken) return null

  try {
    const { callFastModel } = await import('./fastClient')

    const jurisdictionCtx = jurisdiction ? ` in ${jurisdiction}` : ''
    const prompt = `Generate the complete subject and topic structure for the ${examName}${jurisdictionCtx}.

You are an expert on this exam's official program and syllabus. Generate the standard subjects and topics as they appear on the OFFICIAL program/syllabus.

CRITICAL: Only include topics that are actually part of the official program. Do NOT invent topics or include content from different levels/tracks. If you are not 100% confident about a topic being in the official program, do NOT include it. It is better to have fewer accurate topics than many inaccurate ones.

For French exams (CPGE, Concours, Bac, etc.): use the official Bulletin Officiel program. Use French terminology for topic names.

Return ONLY valid JSON:
{
  "examName": "${examName}",
  "subjects": [
    {
      "name": "Subject Name",
      "weight": 30,
      "chapters": [
        {
          "name": "Chapter Name",
          "topics": [
            { "name": "Topic Name" }
          ]
        }
      ]
    }
  ]
}

Rules:
- Include ALL standard subjects for this exam
- Weights should reflect official exam weighting and sum to 100
- Use official terminology from the program
- 2-8 chapters per subject, 2-10 topics per chapter
- Be comprehensive but ACCURATE — only include topics you are certain belong to this specific program
- Names should be in the language of the exam (French for French exams)`

    const raw = await callFastModel(
      prompt,
      'You are a curriculum expert with deep knowledge of official exam programs and syllabi. Generate exam topic structures based on the OFFICIAL program only. Return only valid JSON. Use the exam\'s language for topic names.',
      authToken,
      { maxTokens: 8192 },
    )

    const clean = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '')
    const jsonMatch = clean.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null

    const parsed = JSON.parse(jsonMatch[0])
    const subjects = parsed.subjects ?? []
    if (!Array.isArray(subjects) || subjects.length === 0) return null

    // Normalize (same logic as extractLandscapeFromText)
    for (const s of subjects) {
      const raw = s as Record<string, unknown>
      if (!s.chapters && raw.chapitres) s.chapters = raw.chapitres as ExtractedSubject['chapters']
      if (s.chapters && Array.isArray(s.chapters) && s.chapters.length > 0) {
        s.topics = s.chapters.flatMap((ch: ExtractedChapter) => ch.topics ?? [])
      }
      if (!s.chapters || s.chapters.length === 0) {
        if (s.topics && s.topics.length > 0) {
          s.chapters = [{ name: 'General', topics: s.topics }]
        }
      }
      if (!s.topics) s.topics = []
    }

    return { examName: parsed.examName ?? examName, subjects }
  } catch {
    return null
  }
}
