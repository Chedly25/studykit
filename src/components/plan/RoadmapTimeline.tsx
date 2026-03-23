import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useAuth } from '@clerk/clerk-react'
import { useTranslation } from 'react-i18next'
import { Map, ChevronUp, Loader2 } from 'lucide-react'
import { db } from '../../db'
import { generateMacroRoadmap } from '../../lib/macroRoadmap'
import type { MacroPhase } from '../../db/schema'

interface Props {
  examProfileId: string
}

export function RoadmapTimeline({ examProfileId }: Props) {
  const { t } = useTranslation()
  const { getToken } = useAuth()
  const [isGenerating, setIsGenerating] = useState(false)
  const [expandedPhase, setExpandedPhase] = useState<string | null>(null)

  const roadmap = useLiveQuery(
    () => db.macroRoadmaps.get(examProfileId),
    [examProfileId],
  )

  const handleGenerate = async () => {
    setIsGenerating(true)
    try {
      const token = await getToken()
      if (token) await generateMacroRoadmap(examProfileId, token)
    } catch (err) {
      console.error('Roadmap generation failed:', err)
    } finally {
      setIsGenerating(false)
    }
  }

  if (!roadmap) {
    return (
      <div className="glass-card p-4 mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Map className="w-4 h-4 text-[var(--accent-text)]" />
          <div>
            <p className="text-sm font-medium text-[var(--text-heading)]">{t('roadmap.title')}</p>
            <p className="text-xs text-[var(--text-muted)]">{t('roadmap.subtitle')}</p>
          </div>
        </div>
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5"
        >
          {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Map className="w-3 h-3" />}
          {isGenerating ? t('roadmap.generating') : t('roadmap.generate')}
        </button>
      </div>
    )
  }

  let phases: MacroPhase[] = []
  try { phases = JSON.parse(roadmap.phases) } catch { return null }
  if (phases.length === 0) return null

  const activeIndex = phases.findIndex(p => p.status === 'active')

  return (
    <div className="glass-card p-4 mb-4 animate-fade-in">
      <div className="flex items-center gap-2 mb-3">
        <Map className="w-4 h-4 text-[var(--accent-text)]" />
        <span className="text-sm font-semibold text-[var(--text-heading)]">{t('roadmap.title')}</span>
      </div>

      {/* Timeline bar */}
      <div className="flex gap-1 mb-3">
        {phases.map((phase, i) => {
          const isActive = phase.status === 'active'
          const isCompleted = phase.status === 'completed'
          return (
            <button
              key={i}
              onClick={() => setExpandedPhase(expandedPhase === phase.name ? null : phase.name)}
              className={`flex-1 h-2.5 rounded-full transition-colors ${
                isCompleted ? 'bg-emerald-500' :
                isActive ? 'bg-[var(--accent-text)]' :
                'bg-[var(--bg-input)]'
              }`}
              title={phase.name}
            />
          )
        })}
      </div>

      {/* Phase labels */}
      <div className="flex gap-1 mb-2">
        {phases.map((phase, i) => {
          const isActive = phase.status === 'active'
          return (
            <button
              key={i}
              onClick={() => setExpandedPhase(expandedPhase === phase.name ? null : phase.name)}
              className={`flex-1 text-center text-[10px] truncate px-0.5 ${
                isActive ? 'text-[var(--accent-text)] font-semibold' : 'text-[var(--text-faint)]'
              }`}
            >
              {phase.name}
            </button>
          )
        })}
      </div>

      {/* Active phase indicator */}
      {activeIndex >= 0 && (
        <p className="text-xs text-[var(--text-muted)] mb-2">
          {t('roadmap.current')} <span className="font-medium text-[var(--text-body)]">{phases[activeIndex].name}</span>
          {phases[activeIndex].startDate && phases[activeIndex].endDate && (
            <span> ({phases[activeIndex].startDate} — {phases[activeIndex].endDate})</span>
          )}
        </p>
      )}

      {/* Expanded phase details */}
      {expandedPhase && (() => {
        const phase = phases.find(p => p.name === expandedPhase)
        if (!phase) return null
        return (
          <div className="bg-[var(--bg-input)] rounded-lg p-3 mt-2 text-sm animate-fade-in">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-[var(--text-heading)]">{phase.name}</span>
              <button onClick={() => setExpandedPhase(null)} className="text-[var(--text-muted)]">
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-xs text-[var(--text-muted)] mb-2">{phase.description}</p>
            {phase.focusAreas.length > 0 && (
              <div className="mb-2">
                <span className="text-xs font-medium text-[var(--text-muted)]">{t('roadmap.focus')} </span>
                <span className="text-xs text-[var(--text-body)]">{phase.focusAreas.join(', ')}</span>
              </div>
            )}
            {phase.milestones.length > 0 && (
              <div>
                <span className="text-xs font-medium text-[var(--text-muted)]">{t('roadmap.milestones')}</span>
                <ul className="mt-1 space-y-0.5">
                  {phase.milestones.map((m, i) => (
                    <li key={i} className="text-xs text-[var(--text-body)] flex items-start gap-1.5">
                      <span className="text-[var(--text-faint)] mt-0.5">•</span> {m}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-2 text-xs text-[var(--text-faint)]">
              {t('roadmap.targetMastery')} {Math.round(phase.targetMastery * 100)}%
            </div>
          </div>
        )
      })()}
    </div>
  )
}
