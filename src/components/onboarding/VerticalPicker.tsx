/**
 * Entry screen for /welcome.
 * Three big chip cards — the user's answer forks the rest of onboarding.
 */
import { Scale, GraduationCap, Sparkles, ArrowRight } from 'lucide-react'
import type { ProfileVertical } from '../../db/schema'

interface Props {
  onPick: (vertical: ProfileVertical) => void
}

interface ChipDef {
  value: ProfileVertical
  title: string
  subtitle: string
  icon: typeof Scale
}

const CHIPS: ChipDef[] = [
  {
    value: 'crfpa',
    title: 'CRFPA',
    subtitle: 'Examen d\'entrée au barreau',
    icon: Scale,
  },
  {
    value: 'cpge',
    title: 'Prépa CPGE',
    subtitle: 'Concours Mines, Centrale, X, CCINP, E3A…',
    icon: GraduationCap,
  },
  {
    value: 'generic',
    title: 'Autre',
    subtitle: 'Cours universitaire, certification, langue, recherche…',
    icon: Sparkles,
  },
]

export function VerticalPicker({ onPick }: Props) {
  return (
    <div className="max-w-xl mx-auto py-16 px-4 min-h-[80vh] flex flex-col justify-center animate-fade-in">
      <div className="text-center mb-10">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-[var(--text-heading)] mb-3">
          Tu prépares quoi&nbsp;?
        </h1>
        <p className="text-[var(--text-muted)] text-base">
          StudiesKit s'adapte à ton parcours. Choisis le tien.
        </p>
      </div>

      <div className="space-y-3">
        {CHIPS.map(chip => {
          const Icon = chip.icon
          return (
            <button
              key={chip.value}
              onClick={() => onPick(chip.value)}
              className="group w-full flex items-center gap-4 p-5 rounded-2xl border border-[var(--border-card)] bg-[var(--bg-card)] hover:border-[var(--accent-text)] hover:bg-[var(--bg-hover)] transition-all text-left"
            >
              <div className="w-12 h-12 rounded-xl bg-[var(--accent-bg)] flex items-center justify-center shrink-0">
                <Icon className="w-6 h-6 text-[var(--accent-text)]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-lg font-semibold text-[var(--text-heading)]">{chip.title}</div>
                <div className="text-sm text-[var(--text-muted)]">{chip.subtitle}</div>
              </div>
              <ArrowRight className="w-5 h-5 text-[var(--text-muted)] group-hover:text-[var(--accent-text)] group-hover:translate-x-1 transition-all shrink-0" />
            </button>
          )
        })}
      </div>

      <p className="text-xs text-[var(--text-muted)] text-center mt-8">
        Tu pourras toujours créer un autre profil plus tard.
      </p>
    </div>
  )
}
