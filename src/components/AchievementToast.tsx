/**
 * Achievement unlock toast — called via Sonner.
 * Renders lucide icon by name from AchievementDef.icon field.
 */
import { toast } from 'sonner'
import { Target, Flame, Dumbbell, Crown, Pencil, BookOpen, Trophy, Layers, CheckSquare, TrendingUp, Star, Globe, Sunrise, Moon, RefreshCw, Compass, GraduationCap, Clock, Zap, Award } from 'lucide-react'
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

export function showAchievementToast(achievement: AchievementDef) {
  const Icon = ICON_MAP[achievement.icon] ?? Award
  toast(
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-amber-500" />
      </div>
      <div>
        <p className="font-bold text-sm text-[var(--text-heading)]">{achievement.title}</p>
        <p className="text-xs text-[var(--text-muted)]">{achievement.description}</p>
      </div>
    </div>,
    { duration: 5000 }
  )
}
