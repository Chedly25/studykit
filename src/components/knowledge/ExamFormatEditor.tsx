import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Plus, Trash2, ChevronUp, ChevronDown, Settings2 } from 'lucide-react'
import { db } from '../../db'
import type { ExamFormat, QuestionFormat } from '../../db/schema'
import { EXAM_PRESETS, PRESET_CATEGORIES } from '../../lib/examPresets'

interface Props {
  open: boolean
  onClose: () => void
  examProfileId: string
}

const SECTION_PRESETS = [
  { formatName: 'QCM / Multiple Choice', description: 'Multiple choice questions', timeAllocation: 60, pointWeight: 30, questionCount: 40, questionFormat: 'multiple-choice' as QuestionFormat },
  { formatName: 'Short Answer', description: 'Brief written responses', timeAllocation: 45, pointWeight: 25, questionCount: 10, questionFormat: 'short-answer' as QuestionFormat },
  { formatName: 'Essay', description: 'Extended written response', timeAllocation: 60, pointWeight: 30, questionCount: 2, questionFormat: 'essay' as QuestionFormat },
  { formatName: 'Case Study', description: 'Scenario analysis with questions', timeAllocation: 90, pointWeight: 40, questionCount: 2, questionFormat: 'vignette' as QuestionFormat },
  { formatName: 'Oral / Viva', description: 'Verbal examination', timeAllocation: 30, pointWeight: 20, questionCount: 5, sectionType: 'oral' as const },
]

const QUESTION_FORMATS: { value: QuestionFormat | ''; label: string }[] = [
  { value: '', label: 'Mixed' },
  { value: 'multiple-choice', label: 'Multiple Choice' },
  { value: 'true-false', label: 'True/False' },
  { value: 'short-answer', label: 'Short Answer' },
  { value: 'essay', label: 'Essay' },
  { value: 'vignette', label: 'Vignette / Case' },
]

export function ExamFormatEditor({ open, onClose, examProfileId }: Props) {
  const { t } = useTranslation()
  const [formats, setFormats] = useState<ExamFormat[]>([])
  const [expandedAdvanced, setExpandedAdvanced] = useState<Set<string>>(new Set())
  const [confirmPreset, setConfirmPreset] = useState(false)

  useEffect(() => {
    if (!open) return
    db.examFormats.where('examProfileId').equals(examProfileId).toArray()
      .then(fmts => setFormats(fmts.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))))
  }, [open, examProfileId])

  if (!open) return null

  const addPreset = async (preset: typeof SECTION_PRESETS[0]) => {
    const format: ExamFormat = {
      id: crypto.randomUUID(),
      examProfileId,
      ...preset,
      order: formats.length,
    }
    await db.examFormats.put(format)
    setFormats(prev => [...prev, format])
  }

  const addCustom = async () => {
    const format: ExamFormat = {
      id: crypto.randomUUID(),
      examProfileId,
      formatName: 'Custom Section',
      description: '',
      timeAllocation: 60,
      pointWeight: 25,
      order: formats.length,
      sectionType: 'written',
    }
    await db.examFormats.put(format)
    setFormats(prev => [...prev, format])
  }

  const updateFormat = async (id: string, updates: Partial<ExamFormat>) => {
    await db.examFormats.update(id, updates)
    setFormats(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f))
  }

  const removeFormat = async (id: string) => {
    await db.examFormats.delete(id)
    setFormats(prev => prev.filter(f => f.id !== id))
  }

  const moveFormat = async (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= formats.length) return
    const newFormats = [...formats]
    const temp = newFormats[index]
    newFormats[index] = newFormats[targetIndex]
    newFormats[targetIndex] = temp
    // Update order in DB
    await db.examFormats.update(newFormats[index].id, { order: index })
    await db.examFormats.update(newFormats[targetIndex].id, { order: targetIndex })
    setFormats(newFormats)
  }

  const applyExamPreset = async (presetId: string) => {
    const preset = EXAM_PRESETS.find(p => p.id === presetId)
    if (!preset) return
    // Delete existing
    for (const f of formats) await db.examFormats.delete(f.id)
    // Create from preset
    const newFormats: ExamFormat[] = preset.sections.map((s, i) => ({
      id: crypto.randomUUID(),
      examProfileId,
      formatName: s.formatName,
      description: s.description,
      timeAllocation: s.timeAllocation,
      pointWeight: s.pointWeight,
      questionCount: s.questionCount,
      questionFormat: s.questionFormat,
      sectionType: s.sectionType ?? 'written',
      order: i,
      negativeMarking: s.negativeMarking,
      negativeMarkingPenalty: s.negativeMarkingPenalty,
      instructions: s.instructions,
      canGoBack: s.canGoBack,
      shuffleQuestions: s.shuffleQuestions,
    }))
    await db.examFormats.bulkPut(newFormats)
    setFormats(newFormats)
    setConfirmPreset(false)
  }

  const toggleAdvanced = (id: string) => {
    setExpandedAdvanced(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const totalTime = formats.reduce((s, f) => s + f.timeAllocation, 0)
  const totalWeight = formats.reduce((s, f) => s + f.pointWeight, 0)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="glass-card w-full max-w-2xl p-6 max-h-[90vh] flex flex-col mx-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-heading)]">{t('examFormat.title')}</h2>
            {formats.length > 0 && (
              <p className="text-xs text-[var(--text-muted)]">
                {formats.length} sections · {totalTime} min · {totalWeight}% total weight
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-heading)]">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Exam preset selector */}
        {formats.length === 0 ? (
          <div className="mb-4">
            <p className="text-sm text-[var(--text-muted)] mb-3">{t('examFormat.usePreset')}</p>
            <div className="space-y-2 mb-4">
              {Object.entries(PRESET_CATEGORIES).map(([cat, label]) => {
                const presets = EXAM_PRESETS.filter(p => p.category === cat)
                if (presets.length === 0) return null
                return (
                  <div key={cat}>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-faint)] mb-1">{label}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {presets.map(p => (
                        <button
                          key={p.id}
                          onClick={() => applyExamPreset(p.id)}
                          className="text-xs px-3 py-1.5 rounded-full bg-[var(--accent-bg)] text-[var(--accent-text)] hover:opacity-80"
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
            <p className="text-xs text-[var(--text-faint)] mb-2">{t('examFormat.orAddManually')}</p>
            <div className="flex flex-wrap gap-2">
              {SECTION_PRESETS.map(p => (
                <button
                  key={p.formatName}
                  onClick={() => addPreset(p)}
                  className="text-xs px-3 py-1.5 rounded-full bg-[var(--bg-input)] text-[var(--text-muted)] hover:text-[var(--accent-text)]"
                >
                  + {p.formatName}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* Section list */}
        <div className="flex-1 overflow-y-auto space-y-3">
          {formats.map((f, idx) => {
            const isAdvanced = expandedAdvanced.has(f.id)
            const isOral = f.sectionType === 'oral'
            return (
              <div key={f.id} className="p-3 rounded-lg border border-[var(--border-card)]">
                {/* Row 1: Name + Type + Reorder + Delete */}
                <div className="flex items-center gap-2 mb-2">
                  <input
                    value={f.formatName}
                    onChange={e => updateFormat(f.id, { formatName: e.target.value })}
                    className="text-sm font-medium text-[var(--text-heading)] bg-transparent border-none focus:outline-none flex-1 min-w-0"
                  />
                  <select
                    value={f.sectionType ?? 'written'}
                    onChange={e => updateFormat(f.id, { sectionType: e.target.value as 'written' | 'oral' | 'practical' })}
                    className="text-[10px] bg-[var(--bg-input)] border border-[var(--border-card)] rounded px-1.5 py-1 text-[var(--text-body)]"
                  >
                    <option value="written">{t('examFormat.written')}</option>
                    <option value="oral">{t('examFormat.oral')}</option>
                    <option value="practical">{t('examFormat.practical')}</option>
                  </select>
                  <div className="flex gap-0.5 shrink-0">
                    <button onClick={() => moveFormat(idx, -1)} disabled={idx === 0} className="p-0.5 text-[var(--text-muted)] hover:text-[var(--text-body)] disabled:opacity-20">
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => moveFormat(idx, 1)} disabled={idx === formats.length - 1} className="p-0.5 text-[var(--text-muted)] hover:text-[var(--text-body)] disabled:opacity-20">
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <button onClick={() => removeFormat(f.id)} className="p-0.5 text-[var(--text-muted)] hover:text-red-500 shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Row 2: Core fields */}
                <div className="grid grid-cols-4 gap-2 mb-1">
                  <div>
                    <label className="text-[10px] text-[var(--text-faint)]">{t('examFormat.time')}</label>
                    <input
                      type="number"
                      value={f.timeAllocation}
                      onChange={e => updateFormat(f.id, { timeAllocation: parseInt(e.target.value) || 0 })}
                      className="input-field w-full text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[var(--text-faint)]">{t('examFormat.weight')}</label>
                    <input
                      type="number"
                      value={f.pointWeight}
                      onChange={e => updateFormat(f.id, { pointWeight: parseInt(e.target.value) || 0 })}
                      className="input-field w-full text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[var(--text-faint)]">{t('examFormat.questions')}</label>
                    <input
                      type="number"
                      value={f.questionCount ?? ''}
                      onChange={e => updateFormat(f.id, { questionCount: parseInt(e.target.value) || undefined })}
                      className="input-field w-full text-xs"
                      placeholder="—"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[var(--text-faint)]">{t('examFormat.questionFormat')}</label>
                    <select
                      value={f.questionFormat ?? ''}
                      onChange={e => updateFormat(f.id, { questionFormat: (e.target.value || undefined) as QuestionFormat | undefined })}
                      className="input-field w-full text-xs"
                    >
                      {QUESTION_FORMATS.map(qf => (
                        <option key={qf.value} value={qf.value}>{qf.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Oral: Prep time */}
                {isOral && (
                  <div className="mt-1 mb-1">
                    <label className="text-[10px] text-[var(--text-faint)]">{t('examFormat.prepTime')}</label>
                    <input
                      type="number"
                      value={f.prepTimeMinutes ?? ''}
                      onChange={e => updateFormat(f.id, { prepTimeMinutes: parseInt(e.target.value) || undefined })}
                      className="input-field w-24 text-xs"
                      placeholder="—"
                    />
                  </div>
                )}

                {/* Advanced toggle */}
                <button
                  onClick={() => toggleAdvanced(f.id)}
                  className="flex items-center gap-1 text-[10px] text-[var(--text-muted)] hover:text-[var(--accent-text)] mt-1"
                >
                  <Settings2 className="w-3 h-3" />
                  {t('examFormat.advanced')}
                  {isAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>

                {/* Advanced section */}
                {isAdvanced && (
                  <div className="mt-2 pt-2 border-t border-[var(--border-card)] space-y-2">
                    <div>
                      <label className="text-[10px] text-[var(--text-faint)]">{t('examFormat.samplePrompt')}</label>
                      <textarea
                        value={f.samplePrompt ?? ''}
                        onChange={e => updateFormat(f.id, { samplePrompt: e.target.value || undefined })}
                        className="input-field w-full text-xs resize-none"
                        rows={2}
                        placeholder={t('examFormat.samplePromptHint')}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-[var(--text-faint)]">{t('examFormat.instructions')}</label>
                      <textarea
                        value={f.instructions ?? ''}
                        onChange={e => updateFormat(f.id, { instructions: e.target.value || undefined })}
                        className="input-field w-full text-xs resize-none"
                        rows={2}
                        placeholder={t('examFormat.instructionsHint')}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-[var(--text-faint)]">{t('examFormat.passingScore')}</label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={f.passingScore ?? ''}
                          onChange={e => updateFormat(f.id, { passingScore: parseInt(e.target.value) || undefined })}
                          className="input-field w-full text-xs"
                          placeholder="—"
                        />
                      </div>
                      {f.negativeMarking && (
                        <div>
                          <label className="text-[10px] text-[var(--text-faint)]">{t('examFormat.penalty')}</label>
                          <input
                            type="number"
                            step={0.25}
                            min={0}
                            value={f.negativeMarkingPenalty ?? 0.25}
                            onChange={e => updateFormat(f.id, { negativeMarkingPenalty: parseFloat(e.target.value) || 0.25 })}
                            className="input-field w-full text-xs"
                          />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-4">
                      <label className="flex items-center gap-1.5 text-xs text-[var(--text-body)] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={f.shuffleQuestions ?? false}
                          onChange={e => updateFormat(f.id, { shuffleQuestions: e.target.checked })}
                          className="rounded border-[var(--border-card)]"
                        />
                        {t('examFormat.shuffleQuestions')}
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-[var(--text-body)] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={f.negativeMarking ?? false}
                          onChange={e => updateFormat(f.id, { negativeMarking: e.target.checked })}
                          className="rounded border-[var(--border-card)]"
                        />
                        {t('examFormat.negativeMarking')}
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-[var(--text-body)] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={f.canGoBack ?? false}
                          onChange={e => updateFormat(f.id, { canGoBack: e.target.checked })}
                          className="rounded border-[var(--border-card)]"
                        />
                        {t('examFormat.canGoBack')}
                      </label>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center mt-4 pt-3 border-t border-[var(--border-card)]">
          <div className="flex gap-2 flex-wrap">
            <button onClick={addCustom} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1">
              <Plus className="w-3 h-3" /> {t('examFormat.addSection')}
            </button>
            {formats.length > 0 && (
              <>
                {SECTION_PRESETS.filter(p => !formats.some(f => f.formatName === p.formatName)).slice(0, 3).map(p => (
                  <button
                    key={p.formatName}
                    onClick={() => addPreset(p)}
                    className="text-[10px] px-2 py-1 rounded bg-[var(--bg-input)] text-[var(--text-muted)] hover:text-[var(--accent-text)]"
                  >
                    + {p.formatName}
                  </button>
                ))}
                <select
                  value=""
                  onChange={e => {
                    if (e.target.value) {
                      if (formats.length > 0 && !confirmPreset) {
                        if (confirm(t('examFormat.replaceConfirm'))) {
                          applyExamPreset(e.target.value)
                        }
                      } else {
                        applyExamPreset(e.target.value)
                      }
                      e.target.value = ''
                    }
                  }}
                  className="text-[10px] bg-[var(--bg-input)] border border-[var(--border-card)] rounded px-2 py-1 text-[var(--text-muted)]"
                >
                  <option value="">{t('examFormat.usePreset')}</option>
                  {Object.entries(PRESET_CATEGORIES).map(([cat, label]) => {
                    const presets = EXAM_PRESETS.filter(p => p.category === cat)
                    if (presets.length === 0) return null
                    return (
                      <optgroup key={cat} label={label}>
                        {presets.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </optgroup>
                    )
                  })}
                </select>
              </>
            )}
          </div>
          <button onClick={onClose} className="btn-primary text-sm px-4 py-1.5">
            {t('common.done')}
          </button>
        </div>
      </div>
    </div>
  )
}
