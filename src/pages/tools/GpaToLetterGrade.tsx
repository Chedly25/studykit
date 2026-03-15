import { useState, useMemo } from 'react'
import { ToolSEO } from '../../components/SEO'
import { FormToolPage } from '../../components/FormToolPage'
import { getToolBySlug } from '../../lib/tools'

const tool = getToolBySlug('gpa-to-letter-grade')!

interface GradeEntry {
  label: string
  gpa: number
  color: string
}

const GRADE_SCALE: GradeEntry[] = [
  { label: 'A', gpa: 4.0, color: 'bg-emerald-500' },
  { label: 'A-', gpa: 3.7, color: 'bg-emerald-400' },
  { label: 'B+', gpa: 3.3, color: 'bg-teal-400' },
  { label: 'B', gpa: 3.0, color: 'bg-teal-500' },
  { label: 'B-', gpa: 2.7, color: 'bg-cyan-500' },
  { label: 'C+', gpa: 2.3, color: 'bg-sky-500' },
  { label: 'C', gpa: 2.0, color: 'bg-blue-500' },
  { label: 'C-', gpa: 1.7, color: 'bg-indigo-500' },
  { label: 'D+', gpa: 1.3, color: 'bg-orange-500' },
  { label: 'D', gpa: 1.0, color: 'bg-orange-600' },
  { label: 'F', gpa: 0.0, color: 'bg-red-500' },
]

type InputMode = 'gpa' | 'letter'

function gpaToLetter(gpa: number): string {
  for (const entry of GRADE_SCALE) {
    if (gpa >= entry.gpa - 0.15) return entry.label
  }
  return 'F'
}

function letterToGpa(letter: string): number {
  const entry = GRADE_SCALE.find(g => g.label === letter)
  return entry ? entry.gpa : 0
}

export default function GpaToLetterGrade() {
  const [inputMode, setInputMode] = useState<InputMode>('gpa')
  const [gpaInput, setGpaInput] = useState(3.5)
  const [letterInput, setLetterInput] = useState('A')

  const conversion = useMemo(() => {
    if (inputMode === 'gpa') {
      const clamped = Math.max(0, Math.min(4.0, gpaInput))
      return { gpa: clamped, letter: gpaToLetter(clamped) }
    }
    const gpa = letterToGpa(letterInput)
    return { gpa, letter: letterInput }
  }, [inputMode, gpaInput, letterInput])

  const activeIndex = GRADE_SCALE.findIndex(g => g.label === conversion.letter)

  return (
    <>
      <ToolSEO title={tool.seoTitle} description={tool.seoDescription} slug={tool.slug} keywords={tool.keywords} />
      <FormToolPage toolId={tool.id} title={tool.name} description={tool.description}>
        {/* Mode toggle */}
        <div className="flex gap-2 mb-6 justify-center">
          <button
            onClick={() => setInputMode('gpa')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              inputMode === 'gpa' ? 'btn-primary' : 'btn-secondary'
            }`}
          >
            GPA to Letter
          </button>
          <button
            onClick={() => setInputMode('letter')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              inputMode === 'letter' ? 'btn-primary' : 'btn-secondary'
            }`}
          >
            Letter to GPA
          </button>
        </div>

        {/* Input */}
        <div className="glass-card p-6 mb-6">
          {inputMode === 'gpa' ? (
            <div className="max-w-xs mx-auto">
              <label className="text-surface-400 text-sm mb-1.5 block text-center">Enter GPA (0.0 - 4.0)</label>
              <input
                type="number"
                min={0}
                max={4.0}
                step={0.01}
                value={gpaInput}
                onChange={e => setGpaInput(parseFloat(e.target.value) || 0)}
                className="input-field text-center text-lg"
              />
            </div>
          ) : (
            <div className="max-w-xs mx-auto">
              <label className="text-surface-400 text-sm mb-1.5 block text-center">Select Letter Grade</label>
              <select
                value={letterInput}
                onChange={e => setLetterInput(e.target.value)}
                className="select-field text-center text-lg"
              >
                {GRADE_SCALE.map(g => (
                  <option key={g.label} value={g.label}>
                    {g.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Result */}
        <div className="glass-card p-6 mb-6 text-center">
          <div className="flex items-center justify-center gap-8">
            <div>
              <p className="text-surface-400 text-xs uppercase tracking-wider mb-1">GPA</p>
              <p className="font-[family-name:var(--font-display)] text-4xl font-bold text-primary-400">
                {conversion.gpa.toFixed(1)}
              </p>
            </div>
            <div className="text-surface-600 text-2xl">=</div>
            <div>
              <p className="text-surface-400 text-xs uppercase tracking-wider mb-1">Letter</p>
              <p className="font-[family-name:var(--font-display)] text-4xl font-bold text-primary-400">
                {conversion.letter}
              </p>
            </div>
          </div>
        </div>

        {/* Visual scale */}
        <div className="glass-card p-5">
          <p className="text-surface-400 text-xs font-medium uppercase tracking-wider mb-4">
            Grade Scale
          </p>

          {/* Horizontal bar */}
          <div className="flex rounded-lg overflow-hidden h-8 mb-3">
            {GRADE_SCALE.map((entry, i) => {
              const isActive = i === activeIndex
              return (
                <div
                  key={entry.label}
                  className={`flex-1 flex items-center justify-center text-xs font-semibold transition-all ${entry.color} ${
                    isActive ? 'ring-2 ring-white ring-inset scale-y-110 z-10' : 'opacity-60'
                  }`}
                  title={`${entry.label} = ${entry.gpa.toFixed(1)}`}
                >
                  <span className={isActive ? 'text-white' : 'text-white/70'}>{entry.label}</span>
                </div>
              )
            })}
          </div>

          {/* Legend */}
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 mt-4">
            {GRADE_SCALE.map((entry, i) => (
              <div
                key={entry.label}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-all ${
                  i === activeIndex
                    ? 'bg-primary-500/15 border border-primary-500/30 text-primary-300'
                    : 'bg-surface-800/40 text-surface-400'
                }`}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${entry.color}`} />
                <span className="font-medium">{entry.label}</span>
                <span className="text-xs opacity-60 ml-auto">{entry.gpa.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </div>
      </FormToolPage>
    </>
  )
}
