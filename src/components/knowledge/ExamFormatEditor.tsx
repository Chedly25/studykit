import { useState, useEffect } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
import { db } from '../../db'
import type { ExamFormat } from '../../db/schema'

interface Props {
  open: boolean
  onClose: () => void
  examProfileId: string
}

const PRESETS = [
  { formatName: 'QCM / Multiple Choice', description: 'Multiple choice questions', timeAllocation: 60, pointWeight: 30, questionCount: 40 },
  { formatName: 'Short Answer', description: 'Brief written responses', timeAllocation: 45, pointWeight: 25, questionCount: 10 },
  { formatName: 'Essay', description: 'Extended written response', timeAllocation: 60, pointWeight: 30, questionCount: 2 },
  { formatName: 'Case Study', description: 'Scenario analysis with questions', timeAllocation: 90, pointWeight: 40, questionCount: 2 },
  { formatName: 'Oral / Viva', description: 'Verbal examination', timeAllocation: 30, pointWeight: 20, questionCount: 5 },
]

export function ExamFormatEditor({ open, onClose, examProfileId }: Props) {
  const [formats, setFormats] = useState<ExamFormat[]>([])

  useEffect(() => {
    if (!open) return
    db.examFormats.where('examProfileId').equals(examProfileId).toArray().then(setFormats)
  }, [open, examProfileId])

  if (!open) return null

  const addPreset = async (preset: typeof PRESETS[0]) => {
    const format: ExamFormat = {
      id: crypto.randomUUID(),
      examProfileId,
      ...preset,
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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="glass-card w-full max-w-lg p-6 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[var(--text-heading)]">Exam Format</h2>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-heading)]">
            <X className="w-5 h-5" />
          </button>
        </div>

        {formats.length === 0 && (
          <div className="mb-4">
            <p className="text-sm text-[var(--text-muted)] mb-3">Add exam sections from presets:</p>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map(p => (
                <button
                  key={p.formatName}
                  onClick={() => addPreset(p)}
                  className="text-xs px-3 py-1.5 rounded-full bg-[var(--accent-bg)] text-[var(--accent-text)] hover:opacity-80"
                >
                  + {p.formatName}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto space-y-3">
          {formats.map(f => (
            <div key={f.id} className="p-3 rounded-lg border border-[var(--border-card)]">
              <div className="flex items-center justify-between mb-2">
                <input
                  value={f.formatName}
                  onChange={e => updateFormat(f.id, { formatName: e.target.value })}
                  className="text-sm font-medium text-[var(--text-heading)] bg-transparent border-none focus:outline-none flex-1"
                />
                <button onClick={() => removeFormat(f.id)} className="text-[var(--text-muted)] hover:text-red-500">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-[var(--text-muted)]">Time (min)</label>
                  <input
                    type="number"
                    value={f.timeAllocation}
                    onChange={e => updateFormat(f.id, { timeAllocation: parseInt(e.target.value) || 0 })}
                    className="input-field w-full text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--text-muted)]">Weight (%)</label>
                  <input
                    type="number"
                    value={f.pointWeight}
                    onChange={e => updateFormat(f.id, { pointWeight: parseInt(e.target.value) || 0 })}
                    className="input-field w-full text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--text-muted)]">Questions</label>
                  <input
                    type="number"
                    value={f.questionCount ?? ''}
                    onChange={e => updateFormat(f.id, { questionCount: parseInt(e.target.value) || undefined })}
                    className="input-field w-full text-sm"
                    placeholder="—"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-between items-center mt-4">
          <div className="flex gap-2">
            <button onClick={addCustom} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1">
              <Plus className="w-3 h-3" /> Add Section
            </button>
            {formats.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {PRESETS.filter(p => !formats.some(f => f.formatName === p.formatName)).map(p => (
                  <button
                    key={p.formatName}
                    onClick={() => addPreset(p)}
                    className="text-xs px-2 py-1 rounded bg-[var(--bg-input)] text-[var(--text-muted)] hover:text-[var(--accent-text)]"
                  >
                    + {p.formatName}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={onClose} className="btn-primary text-sm px-4 py-1.5">Done</button>
        </div>
      </div>
    </div>
  )
}
