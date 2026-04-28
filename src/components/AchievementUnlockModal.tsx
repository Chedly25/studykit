/**
 * Brief full-screen overlay for major achievement unlocks.
 * Fires confetti on mount. Dismisses on click-anywhere or after 4s.
 */
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Target, Flame, Dumbbell, Crown, Pencil, BookOpen, Trophy, Layers,
  CheckSquare, TrendingUp, Star, Globe, Sunrise, Moon, RefreshCw,
  Compass, GraduationCap, Clock, Zap, Award,
} from 'lucide-react'
import type { AchievementDef } from '../lib/achievements'

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  'target': Target,
  'flame': Flame,
  'dumbbell': Dumbbell,
  'crown': Crown,
  'pencil': Pencil,
  'book-open': BookOpen,
  'trophy': Trophy,
  'layers': Layers,
  'check-square': CheckSquare,
  'trending-up': TrendingUp,
  'star': Star,
  'globe': Globe,
  'sunrise': Sunrise,
  'moon': Moon,
  'refresh-cw': RefreshCw,
  'compass': Compass,
  'graduation-cap': GraduationCap,
  'clock': Clock,
  'zap': Zap,
}

export const MAJOR_ACHIEVEMENTS = new Set([
  'FIRST_SESSION', 'STREAK_7', 'STREAK_30', 'STREAK_100',
  'FIRST_TOPIC_80', 'ALL_TOPICS_30',
])

interface Props {
  achievement: AchievementDef
  onDismiss: () => void
}

export function AchievementUnlockModal({ achievement, onDismiss }: Props) {
  const { t } = useTranslation()
  const Icon = ICON_MAP[achievement.icon] ?? Award

  // Fire confetti on mount
  useEffect(() => {
    import('../lib/confetti').then(({ fireConfetti }) => fireConfetti('achievement')).catch(() => {})
  }, [])

  // Auto-dismiss after 4s
  useEffect(() => {
    const timer = setTimeout(onDismiss, 4000)
    return () => clearTimeout(timer)
  }, [onDismiss])

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onDismiss}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in cursor-pointer"
    >
      <div className="glass-card p-6 max-w-sm w-full mx-4 text-center animate-scale-in" onClick={e => e.stopPropagation()}>
        <div className="w-16 h-16 rounded-2xl bg-[var(--color-warning-bg)] flex items-center justify-center mx-auto mb-4">
          <Icon className="w-9 h-9 text-[var(--color-warning)]" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-warning)] mb-1">
          {t('celebrate.achievementUnlocked')}
        </p>
        <h2 className="text-xl font-bold text-[var(--text-heading)] mb-1">{achievement.title}</h2>
        <p className="text-sm text-[var(--text-muted)]">{achievement.description}</p>
        <p className="text-xs text-[var(--text-faint)] mt-4">{t('celebrate.dismiss')}</p>
      </div>
    </div>
  )
}
