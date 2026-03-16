import { useState, useEffect } from 'react'
import { DollarSign, TrendingUp } from 'lucide-react'
import { StatCard } from '../../components/admin/StatCard'
import { useAdmin } from '../../hooks/useAdmin'

interface Subscription {
  id: string
  customerEmail: string
  customerName: string | null
  mrr: number
  currentPeriodEnd: number
}

interface Charge {
  id: string
  amount: number
  created: number
  customer: string
  description: string | null
}

interface RevenueData {
  mrr: number
  arr: number
  activeSubscriptions: Subscription[]
  recentCharges: Charge[]
}

const periods = [
  { label: '7d', value: 7 },
  { label: '30d', value: 30 },
  { label: '90d', value: 90 },
]

export default function Revenue() {
  const { fetchAdmin } = useAdmin()
  const [data, setData] = useState<RevenueData | null>(null)
  const [period, setPeriod] = useState(30)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')
    fetchAdmin<RevenueData>(`/api/admin/revenue?period=${period}`)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [fetchAdmin, period])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[var(--text-heading)]">Revenue</h1>
        <div className="flex gap-1 bg-[var(--bg-input)] rounded-lg p-1">
          {periods.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                period === p.value
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <StatCard icon={DollarSign} label="MRR" value={`$${data.mrr.toFixed(2)}`} />
            <StatCard icon={TrendingUp} label="ARR" value={`$${data.arr.toFixed(2)}`} />
          </div>

          {/* Active Subscriptions */}
          <div className="glass-card p-4 mb-6">
            <h2 className="text-lg font-semibold text-[var(--text-heading)] mb-4">
              Active Subscriptions ({data.activeSubscriptions.length})
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-card)]">
                    <th className="text-left py-2 px-3 text-[var(--text-muted)] font-medium">Customer</th>
                    <th className="text-left py-2 px-3 text-[var(--text-muted)] font-medium">MRR</th>
                    <th className="text-left py-2 px-3 text-[var(--text-muted)] font-medium">Renews</th>
                  </tr>
                </thead>
                <tbody>
                  {data.activeSubscriptions.map((sub) => (
                    <tr key={sub.id} className="border-b border-[var(--border-card)] last:border-0">
                      <td className="py-2 px-3">
                        <div className="text-[var(--text-heading)]">{sub.customerName || 'N/A'}</div>
                        <div className="text-[var(--text-muted)] text-xs">{sub.customerEmail}</div>
                      </td>
                      <td className="py-2 px-3 text-[var(--text-body)]">${sub.mrr.toFixed(2)}</td>
                      <td className="py-2 px-3 text-[var(--text-muted)]">
                        {new Date(sub.currentPeriodEnd * 1000).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                  {data.activeSubscriptions.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-4 text-center text-[var(--text-muted)]">
                        No active subscriptions
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Charges */}
          <div className="glass-card p-4">
            <h2 className="text-lg font-semibold text-[var(--text-heading)] mb-4">
              Recent Charges
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-card)]">
                    <th className="text-left py-2 px-3 text-[var(--text-muted)] font-medium">Amount</th>
                    <th className="text-left py-2 px-3 text-[var(--text-muted)] font-medium">Date</th>
                    <th className="text-left py-2 px-3 text-[var(--text-muted)] font-medium">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentCharges.map((charge) => (
                    <tr key={charge.id} className="border-b border-[var(--border-card)] last:border-0">
                      <td className="py-2 px-3 text-[var(--text-heading)] font-medium">
                        ${charge.amount.toFixed(2)}
                      </td>
                      <td className="py-2 px-3 text-[var(--text-muted)]">
                        {new Date(charge.created * 1000).toLocaleDateString()}
                      </td>
                      <td className="py-2 px-3 text-[var(--text-body)]">
                        {charge.description || '-'}
                      </td>
                    </tr>
                  ))}
                  {data.recentCharges.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-4 text-center text-[var(--text-muted)]">
                        No charges in this period
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
