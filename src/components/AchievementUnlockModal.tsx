/**
 * Brief full-screen overlay for major achievement unlocks.
 * Fires confetti on mount. Dismisses on click-anywhere or after 4s.
 */
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Target, Flame, Dumbbell, Crown, Pencil, BookOpen, Trophy, Layers,
  CheckSquare, TrendingUp, Star, Globe, Sunrise, Moon, RefreshCw,
  Compass, GraduationCap, Clock, Zap, Award,
} from 'lucide-react'
import type { AchievementDef } from '../lib/achievements'
import { Modal, ModalBackdrop } from './ui/motion'

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

// eslint-disable-next-line react-refresh/only-export-components
export const MAJOR_ACHIEVEMENTS = new Set([
  'FIRST_SESSION', 'STREAK_7', 'STREAK_30', 'STREAK_100',
  'FIRST_TOPIC_80', 'ALL_TOPICS_30',
])

interface Props {
  open: boolean
  achievement: AchievementDef | null
  onDismiss: () => void
}

export function AchievementUnlockModal({ open, achievement, onDismiss }: Props) {
  const { t } = useTranslation()

  // Retain the last seen achievement so the exit animation has content to render
  // after the parent sets `achievement` back to null on dismiss.
  const lastAchievementRef = useRef<AchievementDef | null>(achievement)
  if (achievement) lastAchievementRef.current = achievement
  const displayed = lastAchievementRef.current
  const Icon = displayed ? (ICON_MAP[displayed.icon] ?? Award) : Award

  // Fire confetti when the modal opens
  useEffect(() => {
    if (!open) return
    import('../lib/confetti').then(({ fireConfetti }) => fireConfetti('achievement')).catch(() => {})
  }, [open])

  // Auto-dismiss after 4s while open
  useEffect(() => {
    if (!open) return
    const timer = setTimeout(onDismiss, 4000)
    return () => clearTimeout(timer)
  }, [open, onDismiss])

  if (!displayed) return null

  return (
    <ModalBackdrop
      open={open}
      onClose={onDismiss}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm cursor-pointer"
    >
      <Modal open={open} className="glass-card p-6 max-w-sm w-full mx-4 text-center">
        <div role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-warning-bg)] flex items-center justify-center mx-auto mb-4">
            <Icon className="w-9 h-9 text-[var(--color-warning)]" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-warning)] mb-1">
            {t('celebrate.achievementUnlocked')}
          </p>
          <h2 className="text-xl font-bold text-[var(--text-heading)] mb-1">{displayed.title}</h2>
          <p className="text-sm text-[var(--text-muted)]">{displayed.description}</p>
          <p className="text-xs text-[var(--text-faint)] mt-4">{t('celebrate.dismiss')}</p>
        </div>
      </Modal>
    </ModalBackdrop>
  )
}
