/**
 * Generates a personalized study plan via AI.
 */
import { streamChat } from './client'
import { db } from '../db'
import type { StudyPlan, StudyPlanDay } from '../db/schema'

export async function generateStudyPlan(
  examProfileId: string,
  authToken: string,
  daysAhead = 7,
): Promise<{ plan: StudyPlan; days: StudyPlanDay[] }> {
  // Gather context
  const profile = await db.examProfiles.get(examProfileId)
  if (!profile) throw new Error('No exam profile found')

  const subjects = await db.subjects.where('examProfileId').equals(examProfileId).sortBy('order')
  const topics = await db.topics.where('examProfileId').equals(examProfileId).toArray()

  const daysLeft = profile.examDate
    ? Math.max(0, Math.ceil((new Date(profile.examDate).getTime() - Date.now()) / 86400000))
    : null
  const actualDays = daysLeft !== null ? Math.min(daysAhead, daysLeft || daysAhead) : daysAhead

  const weakTopics = [...topics]
    .sort((a, b) => a.mastery - b.mastery)
    .slice(0, 10)
    .map(t => ({
      name: t.name,
      subject: subjects.find(s => s.id === t.subjectId)?.name ?? '',
      mastery: Math.round(t.mastery * 100),
    }))

  const startDate = new Date()
  const dates = Array.from({ length: actualDays }, (_, i) => {
    const d = new Date(startDate)
    d.setDate(d.getDate() + i)
    return d.toISOString().slice(0, 10)
  })

  // Build prerequisite info
  const topicMap = new Map(topics.map(t => [t.id, t]))
  const prereqLines: string[] = []
  for (const topic of topics) {
    if (topic.prerequisiteTopicIds && topic.prerequisiteTopicIds.length > 0) {
      const prereqs = topic.prerequisiteTopicIds
        .map(id => topicMap.get(id))
        .filter(Boolean)
        .map(t => `${t!.name} (${Math.round(t!.mastery * 100)}%)`)
      if (prereqs.length > 0) {
        prereqLines.push(`- ${topic.name} requires: ${prereqs.join(', ')}`)
      }
    }
  }

  const prompt = `Create a ${actualDays}-day study plan for a student preparing for ${profile.name} (${profile.examType}).

Context:${daysLeft !== null ? `\n- Exam date: ${profile.examDate} (${daysLeft} days left)` : '\n- No fixed deadline'}
- Weekly target: ${profile.weeklyTargetHours} hours
- Daily target: ~${Math.round(profile.weeklyTargetHours / 7 * 60)} minutes

Weak topics (prioritize these):
${weakTopics.map(t => `- ${t.name} (${t.subject}) - ${t.mastery}% mastery`).join('\n')}

Subjects with weights:
${subjects.map(s => `- ${s.name}: ${s.weight}% weight, ${Math.round(s.mastery * 100)}% mastery`).join('\n')}
${prereqLines.length > 0 ? `\nTopic dependencies (schedule prerequisites before dependents):\n${prereqLines.join('\n')}` : ''}

Dates for the plan: ${dates.join(', ')}

Available activity types: read, flashcards, practice, socratic, explain-back, review

Return ONLY valid JSON matching this exact schema:
{
  "days": [
    {
      "date": "YYYY-MM-DD",
      "activities": [
        {
          "topicName": "string",
          "activityType": "read|flashcards|practice|socratic|explain-back|review",
          "durationMinutes": number
        }
      ]
    }
  ]
}

Rules:
- Each day should have 2-4 activities
- Total daily duration should be close to ${Math.round(profile.weeklyTargetHours / 7 * 60)} minutes
- Start with weak topics, mix in review of strong topics
- Include variety in activity types
- For days close to the exam, increase practice exams`

  const response = await streamChat({
    messages: [{ role: 'user', content: prompt }],
    system: 'You are a study planning expert. Return only valid JSON.',
    tools: [],
    authToken,
  })

  const text = response.content
    .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
    .map(c => c.text)
    .join('')

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Failed to parse study plan response')

  const parsed = JSON.parse(jsonMatch[0]) as {
    days: Array<{
      date: string
      activities: Array<{
        topicName: string
        activityType: string
        durationMinutes: number
      }>
    }>
  }

  // Deactivate existing plans
  await db.studyPlans
    .where('examProfileId').equals(examProfileId)
    .filter(p => p.isActive)
    .modify({ isActive: false })

  // Create new plan
  const plan: StudyPlan = {
    id: crypto.randomUUID(),
    examProfileId,
    generatedAt: new Date().toISOString(),
    isActive: true,
    totalDays: parsed.days.length,
  }
  await db.studyPlans.put(plan)

  // Create day records
  const days: StudyPlanDay[] = parsed.days.map(d => ({
    id: `${plan.id}:${d.date}`,
    planId: plan.id,
    examProfileId,
    date: d.date,
    activities: JSON.stringify(d.activities.map(a => ({ ...a, completed: false }))),
    isCompleted: false,
  }))
  await db.studyPlanDays.bulkPut(days)

  return { plan, days }
}
