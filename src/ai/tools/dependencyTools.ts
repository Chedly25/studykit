/**
 * Topic dependency tools — prerequisites and dependents.
 */
import { db } from '../../db'

export async function getTopicDependencies(
  examProfileId: string,
  input: { topicName: string }
): Promise<string> {
  const topics = await db.topics.where('examProfileId').equals(examProfileId).toArray()
  const topic = topics.find(t => t.name.toLowerCase() === input.topicName.toLowerCase())
  if (!topic) return JSON.stringify({ error: `Topic "${input.topicName}" not found` })

  const prerequisites = topics.filter(t => (topic.prerequisiteTopicIds ?? []).includes(t.id))
  const dependents = topics.filter(t => (t.prerequisiteTopicIds ?? []).includes(topic.id))

  return JSON.stringify({
    topic: topic.name,
    mastery: Math.round(topic.mastery * 100),
    prerequisites: prerequisites.map(t => ({
      name: t.name,
      mastery: Math.round(t.mastery * 100),
      met: t.mastery >= 0.6,
    })),
    dependents: dependents.map(t => ({
      name: t.name,
      mastery: Math.round(t.mastery * 100),
    })),
    allPrerequisitesMet: prerequisites.every(t => t.mastery >= 0.6),
  }, null, 2)
}

export async function setTopicPrerequisites(
  examProfileId: string,
  input: { topicName: string; prerequisiteNames: string[] }
): Promise<string> {
  const topics = await db.topics.where('examProfileId').equals(examProfileId).toArray()
  const topic = topics.find(t => t.name.toLowerCase() === input.topicName.toLowerCase())
  if (!topic) return JSON.stringify({ error: `Topic "${input.topicName}" not found` })

  const prereqIds: string[] = []
  const notFound: string[] = []
  for (const name of input.prerequisiteNames) {
    const prereq = topics.find(t => t.name.toLowerCase() === name.toLowerCase())
    if (prereq) {
      prereqIds.push(prereq.id)
    } else {
      notFound.push(name)
    }
  }

  await db.topics.update(topic.id, { prerequisiteTopicIds: prereqIds })

  return JSON.stringify({
    success: true,
    topic: topic.name,
    prerequisitesSet: prereqIds.length,
    notFound: notFound.length > 0 ? notFound : undefined,
  })
}
