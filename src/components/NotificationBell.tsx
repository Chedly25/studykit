import { useState, useRef, useEffect } from 'react'
import { Bell, Settings } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useNotifications } from '../hooks/useNotifications'
import { NotificationPreferencesModal } from './NotificationPreferencesModal'

interface Props {
  examProfileId: string | undefined
}

export function NotificationBell({ examProfileId }: Props) {
  const { notifications, unreadCount, markAsRead, markAllRead } = useNotifications(examProfileId)
  const [open, setOpen] = useState(false)
  const [showPrefs, setShowPrefs] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--accent-text)] hover:bg-[var(--bg-input)] transition-colors relative"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-y-auto glass-card shadow-xl z-50 rounded-xl border border-[var(--border-card)]">
          <div className="px-4 py-3 border-b border-[var(--border-card)] flex items-center justify-between">
            <span className="text-sm font-semibold text-[var(--text-heading)]">Notifications</span>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-[var(--accent-text)] hover:underline"
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={() => { setOpen(false); setShowPrefs(true) }}
                className="text-[var(--text-muted)] hover:text-[var(--accent-text)]"
                title="Notification preferences"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">
              No notifications
            </div>
          ) : (
            <div className="divide-y divide-[var(--border-card)]">
              {notifications.slice(0, 10).map(n => (
                <div
                  key={n.id}
                  className={`px-4 py-3 hover:bg-[var(--bg-input)] transition-colors ${!n.isRead ? 'bg-[var(--accent-bg)]/30' : ''}`}
                  onClick={() => markAsRead(n.id)}
                >
                  {n.actionUrl && n.actionUrl.startsWith('/') ? (
                    <Link to={n.actionUrl} onClick={() => setOpen(false)} className="block">
                      <p className="text-sm font-medium text-[var(--text-heading)]">{n.title}</p>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">{n.message}</p>
                    </Link>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-[var(--text-heading)]">{n.title}</p>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">{n.message}</p>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {examProfileId && (
        <NotificationPreferencesModal
          open={showPrefs}
          onClose={() => setShowPrefs(false)}
          examProfileId={examProfileId}
        />
      )}
    </div>
  )
}
