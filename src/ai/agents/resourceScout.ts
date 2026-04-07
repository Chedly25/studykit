/**
 * Resource Scout Agent — finds past exams, study guides, and practice resources.
 * Uses LLM to generate targeted resource recommendations for the student's exam.
 */
import { db } from '../../db'
import type { AgentDefinition, AgentContext, AgentResult } from './types'

export interface ScoutResource {
  title: string
  url: string
  type: 'past-exam' | 'study-guide' | 'practice-questions' | 'outline' | 'other'
  relevance: string
}

export interface ScoutResult {
  resources: ScoutResource[]
  searchedAt: string
  examName: string
}

export const resourceScoutAgent: AgentDefinition = {
  id: 'resource-scout',
  name: 'Resource Scout',
  description: 'Finds past exams, study guides, and practice resources for the student\'s exam',
  triggers: ['manual'],
  model: 'fast',
  cooldownMs: 86400000, // 24 hours

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const { examProfileId, llm } = ctx

    // Load profile
    const profile = await db.examProfiles.get(examProfileId)
    if (!profile) {
      return { success: false, summary: 'No profile found', episodes: [] }
    }

    // Load subjects for context
    const subjects = await db.subjects
      .where('examProfileId').equals(examProfileId)
      .toArray()

    const subjectNames = subjects.map(s => s.name).join(', ')

    // Load diagnostician insight for weak areas
    let weakAreas: string[] = []
    try {
      const insight = await db.agentInsights.get(`diagnostician:${examProfileId}`)
      if (insight) {
        const report = JSON.parse(insight.data) as { priorities?: Array<{ topicName: string; urgency: string }> }
        weakAreas = (report.priorities ?? [])
          .filter(p => p.urgency === 'critical' || p.urgency === 'high')
          .slice(0, 3)
          .map(p => p.topicName)
      }
    } catch { /* ignore */ }

    // Ask LLM to generate resource recommendations
    const weakContext = weakAreas.length > 0
      ? `\nThe student is weak in: ${weakAreas.join(', ')}. Prioritize resources for these areas.`
      : ''

    const raw = await llm(
      `Find study resources for a student preparing for: ${profile.name}
Subjects: ${subjectNames || 'general'}${weakContext}

Generate a JSON array of 6-10 real, well-known resources that would help this student. Include:
- Official past exams or sample questions (with real URLs if you know them)
- Popular study guides and outlines
- Practice question banks
- Free online resources

Return ONLY valid JSON:
[
  {
    "title": "Resource Title",
    "url": "https://...",
    "type": "past-exam|study-guide|practice-questions|outline|other",
    "relevance": "Brief description of why this helps"
  }
]

Rules:
- Only include resources you're confident exist
- Prefer free resources
- Include a mix of types
- URLs should be real and publicly accessible
- If you're unsure about a URL, use a general domain (e.g., official exam board site)`,
      'You are a study resource expert. Generate accurate, helpful resource recommendations. Return only valid JSON array.',
    )

    // Parse response
    let resources: ScoutResource[] = []
    try {
      const jsonMatch = raw.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as ScoutResource[]
        resources = parsed.filter(r => {
          if (!r.title || !r.url || !r.type) return false
          try {
            const u = new URL(r.url)
            return u.protocol === 'https:' || u.protocol === 'http:'
          } catch { return false }
        })
      }
    } catch { /* parse failed */ }

    // Deduplicate by URL
    const seen = new Set<string>()
    resources = resources.filter(r => {
      if (seen.has(r.url)) return false
      seen.add(r.url)
      return true
    })

    const result: ScoutResult = {
      resources,
      searchedAt: new Date().toISOString(),
      examName: profile.name,
    }

    // Write to agent insights
    const now = new Date().toISOString()
    await db.agentInsights.put({
      id: `resource-scout:${examProfileId}`,
      agentId: 'resource-scout',
      examProfileId,
      data: JSON.stringify(result),
      summary: resources.length > 0
        ? `Found ${resources.length} resources for ${profile.name}`
        : `No resources found for ${profile.name}`,
      createdAt: now,
      updatedAt: now,
    })

    return {
      success: true,
      data: result,
      summary: `Found ${resources.length} resources for ${profile.name}`,
      episodes: [],
    }
  },
}
