import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { StudentModel, ConversationSummary } from '../db/schema'

export function useStudentModel(examProfileId: string | undefined) {
  const studentModel = useLiveQuery(
    () => examProfileId
      ? db.studentModels.get(examProfileId)
      : Promise.resolve(undefined as StudentModel | undefined),
    [examProfileId]
  )

  const conversationSummaries = useLiveQuery(
    () => examProfileId
      ? db.conversationSummaries
          .where('examProfileId')
          .equals(examProfileId)
          .toArray()
          .then(summaries => {
            summaries.sort((a, b) => b.sessionDate.localeCompare(a.sessionDate))
            return summaries.slice(0, 10)
          })
      : Promise.resolve([] as ConversationSummary[]),
    [examProfileId]
  ) ?? []

  return { studentModel, conversationSummaries }
}
