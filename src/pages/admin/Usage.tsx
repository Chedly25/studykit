import { useState, useEffect } from 'react'
import { Activity, MessageCircle, Database, Search } from 'lucide-react'
import { useAdmin } from '../../hooks/useAdmin'

interface DailyUsage {
  date: string
  chat: number
  embed: number
  search: number
}

interface UsageData {
  daily: DailyUsage[]
  totals: { chat: number; embed: number; search: number }
}

const periods = [
  { label: '7d', value: 7 },
  { label: '14d', value: 14 },
  { label: '30d', value: 30 },
]

const features = [
  { key: 'chat' as const, label: 'Chat', icon: MessageCircle, color: 'var(--accent-text)' },
  { key: 'embed' as const, label: 'Embed', icon: Database, color: '#f59e0b' },
  { key: 'search' as const, label: 'Search', icon: Search, color: '#8b5cf6' },
]

export default function Usage() {
  const { fetchAdmin } = useAdmin()
  const [data, setData] = useState<UsageData | null>(null)
  const [days, setDays] = useState(30)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')
    fetchAdmin<UsageData>(`/api/admin/usage?days=${days}`)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [fetchAdmin, days])

  const maxDaily = data
    ? Math.max(...data.daily.map((d) => d.chat + d.embed + d.search), 1)
    : 1

  const grandTotal = data
    ? data.totals.chat + data.totals.embed + data.totals.search
    : 0

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[var(--text-heading)]">API Usage</h1>
        <div className="flex gap-1 bg-[var(--bg-input)] rounded-lg p-1">
          {periods.map((p) => (
            <button
              key={p.value}
              onClick={() => setDays(p.value)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                days === p.value
                  ? 'bg-[var(--accent-bg)] text-[var(--accent-text)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-body)]'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="glass-card p-6 text-center">
          <p className="text-red-500">{error}</p>
        </div>
      ) : data ? (
        <>
          {/* Summary */}
          <div className="glass-card p-4 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <Activity size={18} className="text-[var(--accent-text)]" />
              <span className="font-semibold text-[var(--text-heading)]">
                {grandTotal.toLocaleString()} total calls ({days}d)
              </span>
            </div>

            {/* Bar chart */}
            <div className="flex items-end gap-[2px] h-32">
              {data.daily.map((day) => {
                const total = day.chat + day.embed + day.search
                const heightPct = (total / maxDaily) * 100
                const chatPct = total ? (day.chat / total) * 100 : 0
                const embedPct = total ? (day.embed / total) * 100 : 0

                return (
                  <div
                    key={day.date}
                    className="flex-1 flex flex-col justify-end rounded-t-sm overflow-hidden group relative"
                    style={{ height: '100%' }}
                  >
                    <div
                      className="w-full rounded-t-sm flex flex-col justify-end transition-all"
                      style={{ height: `${heightPct}%`, minHeight: total ? '2px' : '0' }}
                    >
                      <div
                        style={{
                          height: `${chatPct}%`,
                          backgroundColor: 'var(--accent-text)',
                          minHeight: day.chat ? '1px' : '0',
                        }}
                      />
                      <div
                        style={{
                          height: `${embedPct}%`,
                          backgroundColor: '#f59e0b',
                          minHeight: day.embed ? '1px' : '0',
                        }}
                      />
                      <div
                        style={{
                          height: `${100 - chatPct - embedPct}%`,
                          backgroundColor: '#8b5cf6',
                          minHeight: day.search ? '1px' : '0',
                        }}
                      />
                    </div>
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                      <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-lg px-3 py-2 text-xs shadow-lg whitespace-nowrap">
                        <div className="font-medium text-[var(--text-heading)] mb-1">{day.date}</div>
                        <div className="text-[var(--text-body)]">Chat: {day.chat}</div>
                        <div className="text-[var(--text-body)]">Embed: {day.embed}</div>
                        <div className="text-[var(--text-body)]">Search: {day.search}</div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Legend */}
            <div className="flex gap-4 mt-3 text-xs text-[var(--text-muted)]">
              {features.map((f) => (
                <div key={f.key} className="flex items-center gap-1.5">
                  <div
                    className="w-2.5 h-2.5 rounded-sm"
                    style={{ backgroundColor: f.color }}
                  />
                  {f.label}
                </div>
              ))}
            </div>
          </div>

          {/* Per-feature breakdown */}
          <div className="glass-card p-4">
            <h2 className="text-lg font-semibold text-[var(--text-heading)] mb-4">
              By Feature
            </h2>
            <div className="space-y-4">
              {features.map((f) => {
                const total = data.totals[f.key]
                const maxFeature = Math.max(
                  data.totals.chat,
                  data.totals.embed,
                  data.totals.search,
                  1
                )
                const pct = (total / maxFeature) * 100

                return (
                  <div key={f.key}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 text-sm text-[var(--text-heading)]">
                        <f.icon size={14} style={{ color: f.color }} />
                        {f.label}
                      </div>
                      <span className="text-sm font-medium text-[var(--text-heading)]">
                        {total.toLocaleString()}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-[var(--bg-input)] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: f.color }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
