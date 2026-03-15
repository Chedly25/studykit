import { useState, useCallback } from 'react'
import { Shuffle, Users } from 'lucide-react'
import { ToolSEO } from '../../components/SEO'
import { FormToolPage } from '../../components/FormToolPage'
import { getToolBySlug } from '../../lib/tools'

const tool = getToolBySlug('random-group-generator')!

function fisherYatesShuffle<T>(arr: T[]): T[] {
  const shuffled = [...arr]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = shuffled[i]
    shuffled[i] = shuffled[j]
    shuffled[j] = temp
  }
  return shuffled
}

export default function RandomGroupGenerator() {
  const [namesText, setNamesText] = useState('')
  const [numGroups, setNumGroups] = useState(2)
  const [groups, setGroups] = useState<string[][]>([])

  const names = namesText
    .split('\n')
    .map(n => n.trim())
    .filter(n => n.length > 0)

  const generateGroups = useCallback(() => {
    if (names.length === 0) return
    const clamped = Math.max(1, Math.min(numGroups, names.length))
    const shuffled = fisherYatesShuffle(names)
    const result: string[][] = Array.from({ length: clamped }, () => [])
    shuffled.forEach((name, i) => {
      result[i % clamped].push(name)
    })
    setGroups(result)
  }, [names, numGroups])

  return (
    <>
      <ToolSEO title={tool.seoTitle} description={tool.seoDescription} slug={tool.slug} keywords={tool.keywords} />
      <FormToolPage toolId={tool.id} title={tool.name} description={tool.description}>
        <div className="space-y-6">
          {/* Input area */}
          <div className="glass-card p-4 space-y-4">
            <div>
              <label className="text-surface-300 text-sm font-medium block mb-1">
                Enter names (one per line)
              </label>
              <textarea
                value={namesText}
                onChange={e => setNamesText(e.target.value)}
                placeholder={"Alice\nBob\nCharlie\nDiana\nEve"}
                rows={8}
                className="input-field w-full resize-y"
              />
              <p className="text-surface-500 text-xs mt-1">
                {names.length} name{names.length !== 1 ? 's' : ''} entered
              </p>
            </div>

            <div className="flex items-end gap-4">
              <div>
                <label className="text-surface-300 text-sm font-medium block mb-1">
                  Number of groups
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={numGroups}
                  onChange={e => setNumGroups(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
                  className="input-field w-24"
                />
              </div>
              <button
                onClick={generateGroups}
                disabled={names.length === 0}
                className="btn-primary flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Shuffle size={16} />
                Generate Groups
              </button>
            </div>
          </div>

          {/* Generated groups */}
          {groups.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-surface-100">
                  Results
                </h2>
                <button
                  onClick={generateGroups}
                  className="btn-secondary flex items-center gap-2 text-sm"
                >
                  <Shuffle size={14} />
                  Re-shuffle
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {groups.map((group, i) => (
                  <div key={i} className="glass-card p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Users size={16} className="text-primary-400" />
                      <h3 className="font-[family-name:var(--font-display)] font-semibold text-surface-100">
                        Group {i + 1}
                      </h3>
                      <span className="text-surface-500 text-xs ml-auto">
                        {group.length} member{group.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <ol className="list-decimal list-inside space-y-1">
                      {group.map((name, j) => (
                        <li key={j} className="text-surface-200 text-sm">
                          {name}
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </FormToolPage>
    </>
  )
}
