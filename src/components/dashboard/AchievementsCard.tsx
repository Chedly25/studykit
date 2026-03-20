/**
 * Achievement badge showcase for dashboard.
 */
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronDown, ChevronRight, Trophy } from 'lucide-react'
import { db } from '../../db'
import { ACHIEVEMENTS } from '../../lib/achievements'

interface Props {
  examProfileId: string
}

export function AchievementsCard({ examProfileId }: Props) {
  const [expanded, setExpanded] = useState(false)

  const unlocked = useLiveQuery(
    () => db.achievements.where('examProfileId').equals(examProfileId).toArray(),
    [examProfileId]
  ) ?? []

  const unlockedIds = new Set(unlocked.map(a => a.achievementId))
  const unlockedCount = unlockedIds.size

  if (ACHIEVEMENTS.length === 0) return null

  return (
    <div className="glass-card overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-input)]/30 transition-colors"
      >
        <Trophy className="w-4 h-4 text-amber-500" />
        <span className="text-sm font-semibold text-[var(--text-heading)] flex-1 text-left">
          Achievements
        </span>
        <span className="text-xs text-[var(--text-muted)]">
          {unlockedCount}/{ACHIEVEMENTS.length}
        </span>
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
        ) : (
          <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-[var(--border-card)] px-4 py-3">
          <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
            {ACHIEVEMENTS.map(a => {
              const isUnlocked = unlockedIds.has(a.id)
              return (
                <div
                  key={a.id}
                  className={`flex flex-col items-center gap-1 p-2 rounded-lg text-center ${
                    isUnlocked ? '' : 'opacity-30 grayscale'
                  }`}
                  title={`${a.title}: ${a.description}${isUnlocked ? '' : ' (locked)'}`}
                >
                  <span className="text-2xl">{a.icon}</span>
                  <span className="text-[10px] font-medium text-[var(--text-muted)] leading-tight">{a.title}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
