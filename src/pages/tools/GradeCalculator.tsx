import { useState, useCallback, useMemo } from 'react'
import { Trash2, Plus } from 'lucide-react'
import { ToolSEO } from '../../components/SEO'
import { FormToolPage } from '../../components/FormToolPage'
import { getToolBySlug } from '../../lib/tools'

const tool = getToolBySlug('grade-calculator')!

interface Assignment {
  name: string
  score: number
  weight: number
}

const LETTER_GRADES: { label: string; min: number }[] = [
  { label: 'A+', min: 97 },
  { label: 'A', min: 93 },
  { label: 'A-', min: 90 },
  { label: 'B+', min: 87 },
  { label: 'B', min: 83 },
  { label: 'B-', min: 80 },
  { label: 'C+', min: 77 },
  { label: 'C', min: 73 },
  { label: 'C-', min: 70 },
  { label: 'D+', min: 67 },
  { label: 'D', min: 63 },
  { label: 'D-', min: 60 },
  { label: 'F', min: 0 },
]

function getLetterGrade(percent: number): string {
  for (const g of LETTER_GRADES) {
    if (percent >= g.min) return g.label
  }
  return 'F'
}

export default function GradeCalculator() {
  const [assignments, setAssignments] = useState<Assignment[]>([
    { name: '', score: 90, weight: 30 },
    { name: '', score: 85, weight: 25 },
    { name: '', score: 0, weight: 45 },
  ])

  const addAssignment = useCallback(() => {
    setAssignments(prev => [...prev, { name: '', score: 0, weight: 0 }])
  }, [])

  const removeAssignment = useCallback((index: number) => {
    setAssignments(prev => prev.filter((_, i) => i !== index))
  }, [])

  const updateAssignment = useCallback(
    (index: number, field: keyof Assignment, value: string | number) => {
      setAssignments(prev =>
        prev.map((a, i) => (i === index ? { ...a, [field]: value } : a))
      )
    },
    []
  )

  const { weightedGrade, totalWeight } = useMemo(() => {
    let sum = 0
    let wSum = 0
    for (const a of assignments) {
      if (a.weight > 0) {
        sum += (a.score * a.weight) / 100
        wSum += a.weight
      }
    }
    return { weightedGrade: wSum > 0 ? (sum / wSum) * 100 : 0, totalWeight: wSum }
  }, [assignments])

  const remainingWeight = 100 - totalWeight
  const letterGrade = getLetterGrade(weightedGrade)

  return (
    <>
      <ToolSEO title={tool.seoTitle} description={tool.seoDescription} slug={tool.slug} keywords={tool.keywords} />
      <FormToolPage toolId={tool.id} title={tool.name} description={tool.description}>
        {/* Result display */}
        <div className="glass-card p-6 mb-6 text-center">
          <p className="text-[var(--text-muted)] text-sm mb-1">Current Grade</p>
          <p className="font-[family-name:var(--font-display)] text-5xl font-bold text-[var(--accent-text)]">
            {weightedGrade.toFixed(1)}%
          </p>
          <p className="text-[var(--text-body)] text-lg mt-1">{letterGrade}</p>
          <div className="flex items-center justify-center gap-4 mt-3 text-sm">
            <span className="text-[var(--text-muted)]">
              Weight used: <span className={totalWeight > 100 ? 'text-[var(--color-error)]' : 'text-[var(--text-body)]'}>{totalWeight}%</span>
            </span>
            <span className="text-[var(--text-faint)]">&middot;</span>
            <span className="text-[var(--text-muted)]">
              Remaining: <span className={remainingWeight < 0 ? 'text-[var(--color-error)]' : 'text-[var(--text-body)]'}>{remainingWeight}%</span>
            </span>
          </div>
        </div>

        {/* Assignments */}
        <div className="space-y-3 mb-4">
          {assignments.map((assignment, i) => (
            <div key={i} className="glass-card p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1 space-y-3">
                  <input
                    type="text"
                    placeholder={`Assignment ${i + 1}`}
                    value={assignment.name}
                    onChange={e => updateAssignment(i, 'name', e.target.value)}
                    className="input-field"
                  />
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-[var(--text-faint)] text-xs mb-1 block">Score (%)</label>
                      <input
                        type="number"
                        min={0}
                        max={200}
                        step={0.1}
                        value={assignment.score}
                        onChange={e => updateAssignment(i, 'score', parseFloat(e.target.value) || 0)}
                        className="input-field"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-[var(--text-faint)] text-xs mb-1 block">Weight (%)</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        value={assignment.weight}
                        onChange={e => updateAssignment(i, 'weight', parseFloat(e.target.value) || 0)}
                        className="input-field"
                      />
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => removeAssignment(i)}
                  disabled={assignments.length <= 1}
                  className="mt-1 p-2 text-[var(--text-muted)] hover:text-[var(--color-error)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label="Remove assignment"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Add assignment button */}
        <button onClick={addAssignment} className="btn-secondary flex items-center gap-2 mx-auto">
          <Plus size={16} />
          Add Assignment
        </button>

        {/* Letter grade reference */}
        <div className="glass-card p-4 mt-6">
          <p className="text-[var(--text-muted)] text-xs font-medium uppercase tracking-wider mb-3">
            Letter Grade Scale
          </p>
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-13 gap-2">
            {LETTER_GRADES.map(g => (
              <div
                key={g.label}
                className={`text-center rounded-lg py-1.5 px-2 text-xs ${
                  letterGrade === g.label
                    ? 'bg-[var(--accent-bg)] text-[var(--accent-text)] border border-current/30'
                    : 'bg-[var(--bg-input)] text-[var(--text-muted)]'
                }`}
              >
                <p className="font-semibold">{g.label}</p>
                <p className="text-[10px] opacity-70">{g.min}%+</p>
              </div>
            ))}
          </div>
        </div>
      </FormToolPage>
    </>
  )
}
