import { useCallback, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { Notification } from '../db/schema'
import { generateNotifications } from '../lib/notificationGenerator'

export function useNotifications(examProfileId: string | undefined) {
  const notifications = useLiveQuery(
    () => examProfileId
      ? db.notifications
          .where('examProfileId')
          .equals(examProfileId)
          .toArray()
          .then(arr => arr.sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
      : Promise.resolve([] as Notification[]),
    [examProfileId]
  ) ?? []

  const unreadCount = notifications.filter(n => !n.isRead).length

  // Generate notifications on mount
  useEffect(() => {
    if (examProfileId) {
      generateNotifications(examProfileId).catch(console.warn)
    }
  }, [examProfileId])

  const markAsRead = useCallback(async (id: string) => {
    await db.notifications.update(id, { isRead: true })
  }, [])

  const markAllRead = useCallback(async () => {
    if (!examProfileId) return
    await db.notifications
      .where('examProfileId')
      .equals(examProfileId)
      .modify({ isRead: true })
  }, [examProfileId])

  const dismissAll = useCallback(async () => {
    if (!examProfileId) return
    await db.notifications
      .where('examProfileId')
      .equals(examProfileId)
      .delete()
  }, [examProfileId])

  return { notifications, unreadCount, markAsRead, markAllRead, dismissAll }
}
