/**
 * Episode effectiveness updater — closes the feedback loop by checking
 * whether topics improved after tutoring episodes were recorded.
 * Boosts effective episodes, penalizes ineffective ones.
 */
import { db } from '../../db'
import { recallEpisodes, updateEpisodeEffectiveness } from './episodicMemory'

const LOOKBACK_DAYS = 30
const IMPROVEMENT_THRESHOLD = 0.05
const BOOST_DELTA = 0.1
const PENALTY_DELTA = -0.05

/**
 * Update episode effectiveness based on mastery outcomes.
 * For each recent episode with a topicId, check if mastery improved.
 */
export async function updateEpisodeEffectivenessFromOutcomes(
  userId: string,
  examProfileId: string,
): Promise<{ updated: number; boosted: number; penalized: number }> {
  const cutoffDate = new Date(Date.now() - LOOKBACK_DAYS * 86400000).toISOString()

  // Load recent episodes for this user
  const episodes = await recallEpisodes({
    userId,
    limit: 100,
  })

  // Filter to episodes with topicId that are recent enough
  const relevantEpisodes = episodes.filter(
    ep => ep.topicId && ep.createdAt >= cutoffDate
      && (!ep.examProfileId || ep.examProfileId === examProfileId)
  )

  if (relevantEpisodes.length === 0) {
    return { updated: 0, boosted: 0, penalized: 0 }
  }

  // Load topics and mastery snapshots
  const topics = await db.topics
    .where('examProfileId')
    .equals(examProfileId)
    .toArray()
  const topicMap = new Map(topics.map(t => [t.id, t]))

  const snapshots = await db.masterySnapshots
    .where('examProfileId')
    .equals(examProfileId)
    .toArray()

  let updated = 0
  let boosted = 0
  let penalized = 0

  for (const episode of relevantEpisodes) {
    const topic = topicMap.get(episode.topicId!)
    if (!topic) continue

    // Find the closest snapshot BEFORE the episode was created (baseline mastery)
    const episodeDate = episode.createdAt.slice(0, 10)
    const snapshotAtTime = snapshots
      .filter(s => s.topicId === episode.topicId && s.date <= episodeDate)
      .sort((a, b) => b.date.localeCompare(a.date))[0]  // most recent before episode

    const masteryAtTime = snapshotAtTime?.mastery ?? topic.mastery
    const currentMastery = topic.mastery
    const improvement = currentMastery - masteryAtTime

    if (improvement > IMPROVEMENT_THRESHOLD) {
      // Mastery improved → this episode's strategy helped
      await updateEpisodeEffectiveness(episode.id, BOOST_DELTA)
      boosted++
      updated++
    } else if (improvement < -IMPROVEMENT_THRESHOLD) {
      // Mastery declined → this episode's approach wasn't helpful
      await updateEpisodeEffectiveness(episode.id, PENALTY_DELTA)
      penalized++
      updated++
    }
    // No significant change → leave effectiveness as-is
  }

  return { updated, boosted, penalized }
}
