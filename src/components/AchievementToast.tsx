/**
 * Achievement unlock toast — called via Sonner.
 */
import { toast } from 'sonner'
import type { AchievementDef } from '../lib/achievements'

export function showAchievementToast(achievement: AchievementDef) {
  toast(
    <div className="flex items-center gap-3">
      <span className="text-2xl">{achievement.icon}</span>
      <div>
        <p className="font-bold text-sm text-[var(--text-heading)]">{achievement.title}</p>
        <p className="text-xs text-[var(--text-muted)]">{achievement.description}</p>
      </div>
    </div>,
    { duration: 5000 }
  )
}
