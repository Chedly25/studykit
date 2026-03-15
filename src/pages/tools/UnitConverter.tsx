import { useState, useMemo, useCallback } from 'react'
import { ArrowLeftRight } from 'lucide-react'
import { ToolSEO } from '../../components/SEO'
import { FormToolPage } from '../../components/FormToolPage'
import { getToolBySlug } from '../../lib/tools'

const tool = getToolBySlug('unit-converter')!

type UnitCategoryId = 'length' | 'weight' | 'temperature' | 'volume' | 'area' | 'speed' | 'time'

interface UnitDef {
  label: string
  /** Factor to convert to the base unit. For temperature this is ignored. */
  factor: number
}

interface UnitCategory {
  id: UnitCategoryId
  label: string
  units: UnitDef[]
  baseIndex: number
}

const unitCategories: UnitCategory[] = [
  {
    id: 'length',
    label: 'Length',
    baseIndex: 2, // meter
    units: [
      { label: 'Millimeter', factor: 0.001 },
      { label: 'Centimeter', factor: 0.01 },
      { label: 'Meter', factor: 1 },
      { label: 'Kilometer', factor: 1000 },
      { label: 'Inch', factor: 0.0254 },
      { label: 'Foot', factor: 0.3048 },
      { label: 'Yard', factor: 0.9144 },
      { label: 'Mile', factor: 1609.344 },
    ],
  },
  {
    id: 'weight',
    label: 'Weight',
    baseIndex: 2, // kilogram
    units: [
      { label: 'Milligram', factor: 0.000001 },
      { label: 'Gram', factor: 0.001 },
      { label: 'Kilogram', factor: 1 },
      { label: 'Ounce', factor: 0.028349523125 },
      { label: 'Pound', factor: 0.45359237 },
      { label: 'Ton (metric)', factor: 1000 },
    ],
  },
  {
    id: 'temperature',
    label: 'Temperature',
    baseIndex: 0,
    units: [
      { label: 'Celsius', factor: 0 },
      { label: 'Fahrenheit', factor: 0 },
      { label: 'Kelvin', factor: 0 },
    ],
  },
  {
    id: 'volume',
    label: 'Volume',
    baseIndex: 1, // liter
    units: [
      { label: 'Milliliter', factor: 0.001 },
      { label: 'Liter', factor: 1 },
      { label: 'Gallon (US)', factor: 3.785411784 },
      { label: 'Quart (US)', factor: 0.946352946 },
      { label: 'Pint (US)', factor: 0.473176473 },
      { label: 'Cup (US)', factor: 0.2365882365 },
      { label: 'Fluid Ounce (US)', factor: 0.0295735296 },
    ],
  },
  {
    id: 'area',
    label: 'Area',
    baseIndex: 2, // m²
    units: [
      { label: 'mm\u00b2', factor: 0.000001 },
      { label: 'cm\u00b2', factor: 0.0001 },
      { label: 'm\u00b2', factor: 1 },
      { label: 'km\u00b2', factor: 1_000_000 },
      { label: 'in\u00b2', factor: 0.00064516 },
      { label: 'ft\u00b2', factor: 0.09290304 },
      { label: 'yd\u00b2', factor: 0.83612736 },
      { label: 'Acre', factor: 4046.8564224 },
      { label: 'Hectare', factor: 10_000 },
    ],
  },
  {
    id: 'speed',
    label: 'Speed',
    baseIndex: 0, // m/s
    units: [
      { label: 'm/s', factor: 1 },
      { label: 'km/h', factor: 1 / 3.6 },
      { label: 'mph', factor: 0.44704 },
      { label: 'Knots', factor: 0.514444 },
    ],
  },
  {
    id: 'time',
    label: 'Time',
    baseIndex: 3, // second
    units: [
      { label: 'Millisecond', factor: 0.001 },
      { label: 'Second', factor: 1 },
      { label: 'Minute', factor: 60 },
      { label: 'Hour', factor: 3600 },
      { label: 'Day', factor: 86400 },
      { label: 'Week', factor: 604800 },
      { label: 'Month (30d)', factor: 2592000 },
      { label: 'Year (365d)', factor: 31536000 },
    ],
  },
]

function convertTemperature(value: number, fromLabel: string, toLabel: string): number {
  // Convert to Celsius first
  let celsius: number
  switch (fromLabel) {
    case 'Fahrenheit':
      celsius = (value - 32) * (5 / 9)
      break
    case 'Kelvin':
      celsius = value - 273.15
      break
    default:
      celsius = value
  }

  // Convert from Celsius to target
  switch (toLabel) {
    case 'Fahrenheit':
      return celsius * (9 / 5) + 32
    case 'Kelvin':
      return celsius + 273.15
    default:
      return celsius
  }
}

function formatResult(n: number): string {
  if (Number.isNaN(n) || !Number.isFinite(n)) return '0'
  // Remove unnecessary trailing zeros but keep useful precision
  const abs = Math.abs(n)
  if (abs === 0) return '0'
  if (abs >= 1_000_000 || abs < 0.000001) return n.toExponential(6)
  // Use up to 10 decimal places, then strip trailing zeros
  return parseFloat(n.toPrecision(10)).toString()
}

export default function UnitConverter() {
  const [activeCategoryId, setActiveCategoryId] = useState<UnitCategoryId>('length')
  const [fromIndex, setFromIndex] = useState(0)
  const [toIndex, setToIndex] = useState(1)
  const [fromValue, setFromValue] = useState('1')
  const [editingSide, setEditingSide] = useState<'from' | 'to'>('from')

  const activeCategory = useMemo(
    () => unitCategories.find(c => c.id === activeCategoryId)!,
    [activeCategoryId]
  )

  const convert = useCallback(
    (value: number, fromIdx: number, toIdx: number): number => {
      const units = activeCategory.units
      if (activeCategory.id === 'temperature') {
        return convertTemperature(value, units[fromIdx].label, units[toIdx].label)
      }
      const baseValue = value * units[fromIdx].factor
      return baseValue / units[toIdx].factor
    },
    [activeCategory]
  )

  const numericFrom = parseFloat(fromValue) || 0
  const toValue = useMemo(
    () => formatResult(convert(numericFrom, fromIndex, toIndex)),
    [numericFrom, fromIndex, toIndex, convert]
  )

  const handleFromChange = useCallback((raw: string) => {
    setFromValue(raw)
    setEditingSide('from')
  }, [])

  const handleToChange = useCallback(
    (raw: string) => {
      setEditingSide('to')
      const num = parseFloat(raw) || 0
      const reversed = convert(num, toIndex, fromIndex)
      setFromValue(formatResult(reversed))
    },
    [convert, toIndex, fromIndex]
  )

  const displayToValue = editingSide === 'from' ? toValue : undefined

  const handleSwap = useCallback(() => {
    setFromIndex(toIndex)
    setToIndex(fromIndex)
    setFromValue(toValue)
    setEditingSide('from')
  }, [fromIndex, toIndex, toValue])

  const handleCategoryChange = useCallback((id: UnitCategoryId) => {
    setActiveCategoryId(id)
    setFromIndex(0)
    setToIndex(1)
    setFromValue('1')
    setEditingSide('from')
  }, [])

  return (
    <>
      <ToolSEO
        title={tool.seoTitle}
        description={tool.seoDescription}
        slug={tool.slug}
        keywords={tool.keywords}
      />
      <FormToolPage toolId={tool.id} title={tool.name} description={tool.description}>
        <div className="space-y-6">
          {/* Category tabs */}
          <div className="flex flex-wrap gap-2 justify-center">
            {unitCategories.map(cat => (
              <button
                key={cat.id}
                onClick={() => handleCategoryChange(cat.id)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  activeCategoryId === cat.id ? 'btn-primary' : 'btn-secondary'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Converter */}
          <div className="glass-card p-6">
            <div className="flex flex-col md:flex-row items-stretch gap-4">
              {/* From */}
              <div className="flex-1 space-y-2">
                <label className="text-surface-400 text-xs font-medium uppercase tracking-wider block">
                  From
                </label>
                <select
                  value={fromIndex}
                  onChange={e => setFromIndex(Number(e.target.value))}
                  className="select-field"
                >
                  {activeCategory.units.map((u, i) => (
                    <option key={u.label} value={i}>
                      {u.label}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  value={fromValue}
                  onChange={e => handleFromChange(e.target.value)}
                  className="input-field text-lg"
                  placeholder="0"
                />
              </div>

              {/* Swap button */}
              <div className="flex items-center justify-center md:pt-6">
                <button
                  onClick={handleSwap}
                  className="btn-secondary p-3 rounded-full"
                  aria-label="Swap units"
                >
                  <ArrowLeftRight size={20} />
                </button>
              </div>

              {/* To */}
              <div className="flex-1 space-y-2">
                <label className="text-surface-400 text-xs font-medium uppercase tracking-wider block">
                  To
                </label>
                <select
                  value={toIndex}
                  onChange={e => setToIndex(Number(e.target.value))}
                  className="select-field"
                >
                  {activeCategory.units.map((u, i) => (
                    <option key={u.label} value={i}>
                      {u.label}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  value={displayToValue ?? ''}
                  onChange={e => handleToChange(e.target.value)}
                  className="input-field text-lg"
                  placeholder="0"
                />
              </div>
            </div>

            {/* Result sentence */}
            <div className="text-center mt-6 pt-4 border-t border-primary-500/10">
              <p className="text-surface-300">
                <span className="font-[family-name:var(--font-display)] text-xl font-bold text-primary-400">
                  {fromValue || '0'} {activeCategory.units[fromIndex].label}
                </span>
                <span className="mx-2">=</span>
                <span className="font-[family-name:var(--font-display)] text-xl font-bold text-primary-400">
                  {toValue} {activeCategory.units[toIndex].label}
                </span>
              </p>
            </div>
          </div>

          {/* Quick reference table */}
          <div className="glass-card overflow-hidden">
            <div className="px-4 py-3 border-b border-primary-500/10">
              <p className="text-surface-400 text-xs font-medium uppercase tracking-wider">
                Quick Reference: 1 {activeCategory.units[fromIndex].label} =
              </p>
            </div>
            <div className="divide-y divide-primary-500/5">
              {activeCategory.units.map((u, i) => {
                if (i === fromIndex) return null
                const converted = formatResult(convert(1, fromIndex, i))
                return (
                  <button
                    key={u.label}
                    onClick={() => setToIndex(i)}
                    className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors hover:bg-primary-500/5 ${
                      i === toIndex ? 'bg-primary-500/10' : ''
                    }`}
                  >
                    <span className="text-surface-300">{u.label}</span>
                    <span className="text-surface-100 font-mono">{converted}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </FormToolPage>
    </>
  )
}
