import { useState, useMemo } from 'react'
import { ToolSEO } from '../../components/SEO'
import { FormToolPage } from '../../components/FormToolPage'
import { getToolBySlug } from '../../lib/tools'

const tool = getToolBySlug('final-grade-calculator')!

export default function FinalGradeCalculator() {
  const [currentGrade, setCurrentGrade] = useState(85)
  const [desiredGrade, setDesiredGrade] = useState(90)
  const [finalWeight, setFinalWeight] = useState(30)

  const result = useMemo(() => {
    if (finalWeight <= 0 || finalWeight > 100) return null
    const weight = finalWeight / 100
    const needed = (desiredGrade - currentGrade * (1 - weight)) / weight
    return needed
  }, [currentGrade, desiredGrade, finalWeight])

  const resultColor = useMemo(() => {
    if (result === null) return 'text-surface-400'
    if (result <= 100) return 'text-green-400'
    if (result <= 110) return 'text-yellow-400'
    return 'text-red-400'
  }, [result])

  const resultBg = useMemo(() => {
    if (result === null) return 'border-surface-700'
    if (result <= 100) return 'border-green-500/20 bg-green-500/5'
    if (result <= 110) return 'border-yellow-500/20 bg-yellow-500/5'
    return 'border-red-500/20 bg-red-500/5'
  }, [result])

  const message = useMemo(() => {
    if (result === null) return 'Enter valid values above'
    if (result <= 0) return 'You already have your desired grade — no exam needed!'
    if (result <= 90) return 'Very achievable. Keep up the good work!'
    if (result <= 100) return 'You can do it, but you need to study hard.'
    if (result <= 110) return 'Extremely difficult, but technically possible with extra credit.'
    return 'Not achievable. Consider adjusting your desired grade.'
  }, [result])

  return (
    <>
      <ToolSEO title={tool.seoTitle} description={tool.seoDescription} slug={tool.slug} keywords={tool.keywords} />
      <FormToolPage toolId={tool.id} title={tool.name} description={tool.description}>
        <div className="glass-card p-6 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-surface-400 text-sm mb-1.5 block">Current Grade (%)</label>
              <input
                type="number"
                min={0}
                max={200}
                step={0.1}
                value={currentGrade}
                onChange={e => setCurrentGrade(parseFloat(e.target.value) || 0)}
                className="input-field"
              />
            </div>
            <div>
              <label className="text-surface-400 text-sm mb-1.5 block">Desired Grade (%)</label>
              <input
                type="number"
                min={0}
                max={200}
                step={0.1}
                value={desiredGrade}
                onChange={e => setDesiredGrade(parseFloat(e.target.value) || 0)}
                className="input-field"
              />
            </div>
            <div>
              <label className="text-surface-400 text-sm mb-1.5 block">Final Exam Weight (%)</label>
              <input
                type="number"
                min={1}
                max={100}
                step={1}
                value={finalWeight}
                onChange={e => setFinalWeight(parseFloat(e.target.value) || 0)}
                className="input-field"
              />
            </div>
          </div>
        </div>

        {/* Result */}
        <div className={`glass-card p-6 text-center border ${resultBg}`}>
          <p className="text-surface-400 text-sm mb-2">You need on your final</p>
          <p className={`font-[family-name:var(--font-display)] text-5xl font-bold ${resultColor}`}>
            {result !== null ? `${result.toFixed(1)}%` : '--'}
          </p>
          <p className="text-surface-400 text-sm mt-3 max-w-md mx-auto">{message}</p>
        </div>

        {/* Explanation */}
        <div className="glass-card p-5 mt-6">
          <p className="text-surface-400 text-xs font-medium uppercase tracking-wider mb-2">
            How it works
          </p>
          <p className="text-surface-300 text-sm leading-relaxed">
            The formula calculates the minimum score you need on your final exam to achieve
            your desired overall grade. It uses:{' '}
            <span className="text-primary-400 font-mono text-xs">
              needed = (desired - current &times; (1 - weight)) / weight
            </span>
          </p>
        </div>
      </FormToolPage>
    </>
  )
}
