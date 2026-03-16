import { useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { Milestone, MilestoneStatus } from '../db/schema'

export function useMilestones(examProfileId: string | undefined) {
  const milestones = useLiveQuery(
    () => examProfileId
      ? db.milestones.where('examProfileId').equals(examProfileId).sortBy('order')
      : Promise.resolve([] as Milestone[]),
    [examProfileId]
  ) ?? []

  const addMilestone = useCallback(async (
    title: string,
    description: string,
    targetDate?: string,
  ) => {
    if (!examProfileId) return
    const maxOrder = milestones.reduce((max, m) => Math.max(max, m.order), -1)
    await db.milestones.put({
      id: crypto.randomUUID(),
      examProfileId,
      title,
      description,
      targetDate: targetDate || undefined,
      status: 'pending',
      order: maxOrder + 1,
      createdAt: new Date().toISOString(),
    })
  }, [examProfileId, milestones])

  const updateMilestone = useCallback(async (
    id: string,
    updates: Partial<Pick<Milestone, 'title' | 'description' | 'targetDate' | 'status' | 'order'>>
  ) => {
    await db.milestones.update(id, updates)
  }, [])

  const deleteMilestone = useCallback(async (id: string) => {
    await db.milestones.delete(id)
  }, [])

  const nextMilestone = milestones.find(m => m.status !== 'done')
  const doneCount = milestones.filter(m => m.status === 'done').length

  const daysUntilNext = nextMilestone?.targetDate
    ? Math.max(0, Math.ceil((new Date(nextMilestone.targetDate).getTime() - Date.now()) / 86400000))
    : null

  return {
    milestones,
    addMilestone,
    updateMilestone,
    deleteMilestone,
    nextMilestone,
    doneCount,
    daysUntilNext,
  }
}
