/**
 * Research-mode AI tool implementations.
 */
import { db } from '../../db'
import type { TopicStatus } from '../../db/schema'

export async function getResearchThreads(examProfileId: string): Promise<string> {
  const topics = await db.topics.where('examProfileId').equals(examProfileId).toArray()
  const subjects = await db.subjects.where('examProfileId').equals(examProfileId).toArray()
  const subjectMap = new Map(subjects.map(s => [s.id, s]))

  const threads = topics.map(t => ({
    name: t.name,
    area: subjectMap.get(t.subjectId)?.name ?? '',
    status: t.status ?? 'exploring',
    depth: Math.round(t.mastery * 100),
  }))

  return JSON.stringify({ threads })
}

export async function updateThreadStatus(
  examProfileId: string,
  input: { topicName: string; status: string }
): Promise<string> {
  const topics = await db.topics.where('examProfileId').equals(examProfileId).toArray()
  const topic = topics.find(t => t.name.toLowerCase() === input.topicName.toLowerCase())
  if (!topic) return JSON.stringify({ error: `Topic "${input.topicName}" not found` })

  const validStatuses: TopicStatus[] = ['exploring', 'active', 'blocked', 'resolved']
  if (!validStatuses.includes(input.status as TopicStatus)) {
    return JSON.stringify({ error: `Invalid status. Use: ${validStatuses.join(', ')}` })
  }

  await db.topics.update(topic.id, { status: input.status as TopicStatus })
  return JSON.stringify({ success: true, topic: topic.name, status: input.status })
}

export async function getMilestones(examProfileId: string): Promise<string> {
  const milestones = await db.milestones.where('examProfileId').equals(examProfileId).sortBy('order')
  return JSON.stringify({ milestones })
}

export async function updateMilestoneStatus(
  examProfileId: string,
  input: { milestoneId: string; status: string }
): Promise<string> {
  const milestone = await db.milestones.get(input.milestoneId)
  if (!milestone || milestone.examProfileId !== examProfileId) {
    return JSON.stringify({ error: 'Milestone not found' })
  }

  const validStatuses = ['pending', 'in-progress', 'done']
  if (!validStatuses.includes(input.status)) {
    return JSON.stringify({ error: `Invalid status. Use: ${validStatuses.join(', ')}` })
  }

  await db.milestones.update(input.milestoneId, { status: input.status as 'pending' | 'in-progress' | 'done' })
  return JSON.stringify({ success: true, milestone: milestone.title, status: input.status })
}

export async function synthesizeLiterature(
  examProfileId: string,
  input: { documentIds?: string[] }
): Promise<string> {
  let docs
  if (input.documentIds && input.documentIds.length > 0) {
    docs = await Promise.all(
      input.documentIds.map(id => db.documents.get(id))
    )
  } else {
    docs = await db.documents.where('examProfileId').equals(examProfileId).toArray()
  }

  const validDocs = docs.filter(d => d && d.examProfileId === examProfileId)
  if (validDocs.length === 0) {
    return JSON.stringify({ error: 'No documents found' })
  }

  // Gather chunks for synthesis
  const allChunks: string[] = []
  for (const doc of validDocs) {
    if (!doc) continue
    const chunks = await db.documentChunks
      .where('documentId').equals(doc.id)
      .sortBy('chunkIndex')
    allChunks.push(
      `\n--- [${doc.title}] ---\n` +
      chunks.map(c => c.content).join('\n')
    )
  }

  return JSON.stringify({
    instruction: `Synthesize the following ${validDocs.length} documents. Identify key themes, agreements, contradictions, methodological approaches, and gaps in the literature. Organize your synthesis thematically, not document-by-document.`,
    documents: validDocs.map(d => ({ id: d!.id, title: d!.title, wordCount: d!.wordCount })),
    content: allChunks.join('\n').slice(0, 30000), // Cap content length
  })
}

export async function generateMeetingPrep(examProfileId: string): Promise<string> {
  // Gather recent activity
  const topics = await db.topics.where('examProfileId').equals(examProfileId).toArray()
  const milestones = await db.milestones.where('examProfileId').equals(examProfileId).sortBy('order')
  const recentSessions = await db.studySessions
    .where('examProfileId').equals(examProfileId)
    .reverse()
    .limit(10)
    .toArray()

  const blockedThreads = topics.filter(t => t.status === 'blocked')
  const activeThreads = topics.filter(t => t.status === 'active')
  const upcomingMilestones = milestones.filter(m => m.status !== 'done')
  const completedMilestones = milestones.filter(m => m.status === 'done')

  const totalStudyHours = recentSessions.reduce((sum, s) => sum + s.durationSeconds, 0) / 3600

  return JSON.stringify({
    instruction: 'Generate a structured meeting prep document for an advisor meeting. Include: 1) Progress summary, 2) Current focus areas, 3) Blockers & questions, 4) Upcoming milestones, 5) Proposed next steps.',
    context: {
      activeThreads: activeThreads.map(t => ({ name: t.name, depth: Math.round(t.mastery * 100) })),
      blockedThreads: blockedThreads.map(t => ({ name: t.name, depth: Math.round(t.mastery * 100) })),
      milestonesCompleted: completedMilestones.length,
      milestonesRemaining: upcomingMilestones.map(m => ({
        title: m.title,
        targetDate: m.targetDate,
        status: m.status,
      })),
      recentHoursWorked: Math.round(totalStudyHours * 10) / 10,
      recentSessionCount: recentSessions.length,
    },
  })
}

export async function searchNotes(
  examProfileId: string,
  input: { query: string }
): Promise<string> {
  const notes = await db.researchNotes.where('examProfileId').equals(examProfileId).toArray()
  const query = input.query.toLowerCase()
  const matches = notes.filter(n =>
    n.title.toLowerCase().includes(query) ||
    n.content.toLowerCase().includes(query) ||
    n.tags.toLowerCase().includes(query)
  )
  return JSON.stringify({
    results: matches.slice(0, 10).map(n => ({
      id: n.id,
      title: n.title,
      preview: n.content.slice(0, 200),
      tags: JSON.parse(n.tags || '[]'),
    }))
  })
}

export async function findNoteConnections(
  examProfileId: string,
  input: { noteId: string }
): Promise<string> {
  const note = await db.researchNotes.get(input.noteId)
  if (!note || note.examProfileId !== examProfileId) {
    return JSON.stringify({ error: 'Note not found' })
  }

  // Simple keyword-based connection finding
  const allNotes = await db.researchNotes.where('examProfileId').equals(examProfileId).toArray()
  const words = note.content.toLowerCase().split(/\s+/).filter(w => w.length > 4)
  const wordSet = new Set(words)

  const scored = allNotes
    .filter(n => n.id !== note.id)
    .map(n => {
      const nWords = n.content.toLowerCase().split(/\s+/)
      const overlap = nWords.filter(w => wordSet.has(w)).length
      return { id: n.id, title: n.title, score: overlap }
    })
    .filter(n => n.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)

  return JSON.stringify({
    note: { id: note.id, title: note.title },
    connections: scored,
    instruction: 'Based on these potentially related notes, suggest meaningful connections and how they relate to each other.',
  })
}
