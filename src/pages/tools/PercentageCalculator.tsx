import { useState, useMemo } from 'react'
import { ToolSEO } from '../../components/SEO'
import { FormToolPage } from '../../components/FormToolPage'
import { getToolBySlug } from '../../lib/tools'

const tool = getToolBySlug('percentage-calculator')!

type Mode = 'of' | 'is-what' | 'change'

const TABS: { id: Mode; label: string }[] = [
  { id: 'of', label: 'X% of Y' },
  { id: 'is-what', label: 'X is what % of Y' },
  { id: 'change', label: '% Change' },
]

export default function PercentageCalculator() {
  const [mode, setMode] = useState<Mode>('of')

  // Mode 1: X% of Y
  const [percentOf, setPercentOf] = useState(25)
  const [valueOf, setValueOf] = useState(200)

  // Mode 2: X is what % of Y
  const [partValue, setPartValue] = useState(45)
  const [wholeValue, setWholeValue] = useState(180)

  // Mode 3: % change
  const [oldValue, setOldValue] = useState(80)
  const [newValue, setNewValue] = useState(100)

  const result = useMemo(() => {
    switch (mode) {
      case 'of':
        return { value: (percentOf / 100) * valueOf, label: `${percentOf}% of ${valueOf}` }
      case 'is-what':
        if (wholeValue === 0) return { value: 0, label: 'Cannot divide by zero' }
        return { value: (partValue / wholeValue) * 100, label: `${partValue} is what % of ${wholeValue}` }
      case 'change': {
        if (oldValue === 0) return { value: 0, label: 'Cannot divide by zero' }
        const change = ((newValue - oldValue) / Math.abs(oldValue)) * 100
        return { value: change, label: change >= 0 ? 'Increase' : 'Decrease' }
      }
    }
  }, [mode, percentOf, valueOf, partValue, wholeValue, oldValue, newValue])

  return (
    <>
      <ToolSEO title={tool.seoTitle} description={tool.seoDescription} slug={tool.slug} keywords={tool.keywords} />
      <FormToolPage toolId={tool.id} title={tool.name} description={tool.description}>
        {/* Tabs */}
        <div className="flex gap-2 mb-6 justify-center flex-wrap">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setMode(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                mode === tab.id
                  ? 'btn-primary'
                  : 'btn-secondary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Input area */}
        <div className="glass-card p-6 mb-6">
          {mode === 'of' && (
            <div className="flex items-center gap-3 justify-center flex-wrap">
              <span className="text-surface-300 text-sm">What is</span>
              <input
                type="number"
                step={0.1}
                value={percentOf}
                onChange={e => setPercentOf(parseFloat(e.target.value) || 0)}
                className="input-field w-28 text-center"
              />
              <span className="text-surface-300 text-sm">% of</span>
              <input
                type="number"
                step={0.1}
                value={valueOf}
                onChange={e => setValueOf(parseFloat(e.target.value) || 0)}
                className="input-field w-28 text-center"
              />
              <span className="text-surface-300 text-sm">?</span>
            </div>
          )}

          {mode === 'is-what' && (
            <div className="flex items-center gap-3 justify-center flex-wrap">
              <input
                type="number"
                step={0.1}
                value={partValue}
                onChange={e => setPartValue(parseFloat(e.target.value) || 0)}
                className="input-field w-28 text-center"
              />
              <span className="text-surface-300 text-sm">is what % of</span>
              <input
                type="number"
                step={0.1}
                value={wholeValue}
                onChange={e => setWholeValue(parseFloat(e.target.value) || 0)}
                className="input-field w-28 text-center"
              />
              <span className="text-surface-300 text-sm">?</span>
            </div>
          )}

          {mode === 'change' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-surface-400 text-sm mb-1.5 block">Old Value</label>
                <input
                  type="number"
                  step={0.1}
                  value={oldValue}
                  onChange={e => setOldValue(parseFloat(e.target.value) || 0)}
                  className="input-field"
                />
              </div>
              <div>
                <label className="text-surface-400 text-sm mb-1.5 block">New Value</label>
                <input
                  type="number"
                  step={0.1}
                  value={newValue}
                  onChange={e => setNewValue(parseFloat(e.target.value) || 0)}
                  className="input-field"
                />
              </div>
            </div>
          )}
        </div>

        {/* Result */}
        <div className="glass-card p-6 text-center">
          <p className="text-surface-400 text-sm mb-1">{result.label}</p>
          <p className="font-[family-name:var(--font-display)] text-5xl font-bold text-primary-400">
            {mode === 'is-what' || mode === 'change'
              ? `${result.value.toFixed(2)}%`
              : result.value.toFixed(2)}
          </p>
          {mode === 'change' && (
            <p className={`text-sm mt-2 ${result.value >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {result.value >= 0 ? 'Increase' : 'Decrease'} of {Math.abs(result.value).toFixed(2)}%
            </p>
          )}
        </div>
      </FormToolPage>
    </>
  )
}
