import { useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { AdvisorMeeting, AdvisorMeetingStatus } from '../db/schema'

export function useAdvisorMeetings(examProfileId: string | undefined) {
  const meetings = useLiveQuery(
    () => examProfileId
      ? db.advisorMeetings.where('examProfileId').equals(examProfileId).reverse().sortBy('date')
      : Promise.resolve([] as AdvisorMeeting[]),
    [examProfileId]
  ) ?? []

  const upcoming = meetings.filter(m => m.status === 'upcoming')
  const past = meetings.filter(m => m.status === 'completed')

  const addMeeting = useCallback(async (date: string, notes?: string) => {
    if (!examProfileId) return
    await db.advisorMeetings.put({
      id: crypto.randomUUID(),
      examProfileId,
      date,
      summary: '',
      actionItems: '[]',
      notes: notes ?? '',
      status: 'upcoming',
    })
  }, [examProfileId])

  const updateMeeting = useCallback(async (
    id: string,
    updates: Partial<Pick<AdvisorMeeting, 'summary' | 'actionItems' | 'notes' | 'status'>>
  ) => {
    await db.advisorMeetings.update(id, updates)
  }, [])

  const deleteMeeting = useCallback(async (id: string) => {
    await db.advisorMeetings.delete(id)
  }, [])

  return {
    meetings,
    upcoming,
    past,
    addMeeting,
    updateMeeting,
    deleteMeeting,
  }
}
