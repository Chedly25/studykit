import { useState } from 'react'
import { Check, X, ChevronDown, ChevronUp, Award, AlertCircle, Sparkles } from 'lucide-react'

export interface RubricSubItem {
  label: string
  passed: boolean
  note?: string
}

export interface RubricCriterion {
  label: string
  score: number
  max: number
  feedback: string
  subItems?: RubricSubItem[]
}

export interface RubricOverall {
  score: number
  max: number
  topMistake?: string
  strength?: string
}

interface Props {
  criteria: RubricCriterion[]
  overall?: RubricOverall
}

function ratio(score: number, max: number): number {
  if (max <= 0) return 0
  return Math.max(0, Math.min(1, score / max))
}

function tone(r: number): 'good' | 'warn' | 'bad' {
  if (r >= 0.75) return 'good'
  if (r >= 0.4) return 'warn'
  return 'bad'
}

const BAR_COLORS: Record<'good' | 'warn' | 'bad', string> = {
  good: 'bg-emerald-500',
  warn: 'bg-amber-500',
  bad: 'bg-rose-500',
}

const TEXT_COLORS: Record<'good' | 'warn' | 'bad', string> = {
  good: 'text-emerald-600 dark:text-emerald-400',
  warn: 'text-amber-600 dark:text-amber-400',
  bad: 'text-rose-600 dark:text-rose-400',
}

export function GradedRubric({ criteria, overall }: Props) {
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set(criteria.map((_, i) => i)))

  const toggle = (i: number) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i); else next.add(i)
      return next
    })
  }

  return (
    <div className="space-y-4">
      {overall && <OverallBanner overall={overall} />}

      <div className="space-y-2">
        {criteria.map((c, i) => {
          const r = ratio(c.score, c.max)
          const t = tone(r)
          const isOpen = expanded.has(i)
          return (
            <div key={i} className="glass-card overflow-hidden">
              <button
                onClick={() => toggle(i)}
                className="w-full text-left p-3 cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-[var(--text-primary)] flex-1">{c.label}</span>
                  <span className={`text-sm font-semibold tabular-nums ${TEXT_COLORS[t]}`}>
                    {c.score}/{c.max}
                  </span>
                  <span className="text-[var(--text-muted)]">
                    {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </span>
                </div>
                <div className="mt-2 h-1.5 w-full rounded-full bg-[var(--bg-hover)] overflow-hidden">
                  <div
                    className={`h-full ${BAR_COLORS[t]} transition-all`}
                    style={{ width: `${r * 100}%` }}
                  />
                </div>
              </button>
              {isOpen && (
                <div className="px-3 pb-3 space-y-3 border-t border-[var(--border-card)]">
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed pt-3">{c.feedback}</p>
                  {c.subItems && c.subItems.length > 0 && (
                    <ul className="space-y-1.5">
                      {c.subItems.map((si, j) => (
                        <li key={j} className="flex items-start gap-2 text-sm">
                          {si.passed ? (
                            <Check className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <X className="w-4 h-4 mt-0.5 shrink-0 text-rose-600 dark:text-rose-400" />
                          )}
                          <div className="flex-1">
                            <span className="text-[var(--text-primary)]">{si.label}</span>
                            {si.note && (
                              <span className="block text-xs text-[var(--text-muted)] mt-0.5">{si.note}</span>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function OverallBanner({ overall }: { overall: RubricOverall }) {
  const r = ratio(overall.score, overall.max)
  const t = tone(r)
  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Award className={`w-5 h-5 ${TEXT_COLORS[t]}`} />
        <div className="flex-1">
          <div className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold">Note globale</div>
          <div className={`text-2xl font-bold tabular-nums ${TEXT_COLORS[t]}`}>
            {overall.score}<span className="text-base text-[var(--text-muted)] font-normal"> / {overall.max}</span>
          </div>
        </div>
      </div>
      <div className="h-2 w-full rounded-full bg-[var(--bg-hover)] overflow-hidden">
        <div className={`h-full ${BAR_COLORS[t]} transition-all`} style={{ width: `${r * 100}%` }} />
      </div>
      {(overall.strength || overall.topMistake) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
          {overall.strength && (
            <div className="flex items-start gap-2 text-sm">
              <Sparkles className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <div>
                <div className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold">Point fort</div>
                <div className="text-[var(--text-secondary)]">{overall.strength}</div>
              </div>
            </div>
          )}
          {overall.topMistake && (
            <div className="flex items-start gap-2 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <div>
                <div className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold">À corriger en priorité</div>
                <div className="text-[var(--text-secondary)]">{overall.topMistake}</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
