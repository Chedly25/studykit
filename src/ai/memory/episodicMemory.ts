/**
 * Episodic memory — CRUD for tutoring episodes.
 * Per-USER (cross-profile) memory that persists across sessions.
 */
import { db } from '../../db'
import type { TutoringEpisode } from '../../db/schema'
import type { EpisodeQuery } from '../agents/types'

const MAX_EPISODES_PER_USER = 500

/**
 * Query episodes from memory. Results sorted by effectiveness desc.
 */
export async function recallEpisodes(query: EpisodeQuery): Promise<TutoringEpisode[]> {
  const limit = query.limit ?? 20

  let episodes: TutoringEpisode[]

  // Use compound index when possible for performance
  if (query.topicId) {
    episodes = await db.tutoringEpisodes
      .where('[userId+topicId]')
      .equals([query.userId, query.topicId])
      .toArray()
    // Apply type filter if both topicId and type were specified
    if (query.type) {
      episodes = episodes.filter(e => e.type === query.type)
    }
  } else if (query.type) {
    episodes = await db.tutoringEpisodes
      .where('[userId+type]')
      .equals([query.userId, query.type])
      .toArray()
  } else {
    episodes = await db.tutoringEpisodes
      .where('userId')
      .equals(query.userId)
      .toArray()
  }

  // Apply filters that couldn't use indexes
  if (query.topicName) {
    const name = query.topicName.toLowerCase()
    episodes = episodes.filter(e =>
      e.topicName?.toLowerCase().includes(name)
    )
  }

  if (query.minEffectiveness !== undefined) {
    episodes = episodes.filter(e => e.effectiveness >= query.minEffectiveness!)
  }

  // Sort by effectiveness desc, then by createdAt desc
  episodes.sort((a, b) => {
    const effDiff = b.effectiveness - a.effectiveness
    if (effDiff !== 0) return effDiff
    return b.createdAt.localeCompare(a.createdAt)
  })

  return episodes.slice(0, limit)
}

/**
 * Record a new tutoring episode. Returns the generated ID.
 */
export async function recordEpisode(
  episode: Omit<TutoringEpisode, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const id = crypto.randomUUID()
  const now = new Date().toISOString()

  await db.tutoringEpisodes.put({
    ...episode,
    id,
    createdAt: now,
    updatedAt: now,
  })

  return id
}

/**
 * Update the effectiveness score of an episode.
 * Delta is added to the current value and clamped to [0, 1].
 */
export async function updateEpisodeEffectiveness(
  episodeId: string,
  delta: number
): Promise<void> {
  const episode = await db.tutoringEpisodes.get(episodeId)
  if (!episode) return

  const newEffectiveness = Math.max(0, Math.min(1, episode.effectiveness + delta))
  await db.tutoringEpisodes.update(episodeId, {
    effectiveness: newEffectiveness,
    updatedAt: new Date().toISOString(),
  })
}

/**
 * Prune episodes to keep at most MAX_EPISODES_PER_USER.
 * Deletes lowest-effectiveness episodes first.
 */
export async function pruneEpisodes(userId: string): Promise<number> {
  const episodes = await db.tutoringEpisodes
    .where('userId')
    .equals(userId)
    .toArray()

  if (episodes.length <= MAX_EPISODES_PER_USER) return 0

  // Sort by effectiveness ASC (lowest first), then oldest first
  episodes.sort((a, b) => {
    const effDiff = a.effectiveness - b.effectiveness
    if (effDiff !== 0) return effDiff
    return a.createdAt.localeCompare(b.createdAt)
  })

  const toDelete = episodes.slice(0, episodes.length - MAX_EPISODES_PER_USER)
  await db.tutoringEpisodes.bulkDelete(toDelete.map(e => e.id))
  return toDelete.length
}
