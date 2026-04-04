import { useState, useEffect } from 'react'
import { Users, UserPlus, Crown, Euro, TrendingUp, Cpu } from 'lucide-react'
import { StatCard } from '../../components/admin/StatCard'
import { useAdmin } from '../../hooks/useAdmin'

interface Stats {
  totalUsers: number
  newUsers7d: number
  proUsers: number
  mrr: number
  revenue30d: number
  aiCalls7d: number
}

export default function Overview() {
  const { fetchAdmin } = useAdmin()
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAdmin<Stats>('/api/admin/stats')
      .then(setStats)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [fetchAdmin])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="glass-card p-6 text-center">
        <p className="text-red-500">{error}</p>
      </div>
    )
  }

  if (!stats) return null

  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--text-heading)] mb-6">Overview</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard icon={Users} label="Total Users" value={stats.totalUsers} />
        <StatCard icon={UserPlus} label="New Users (7d)" value={stats.newUsers7d} />
        <StatCard icon={Crown} label="Pro Users" value={stats.proUsers} />
        <StatCard
          icon={Euro}
          label="MRR"
          value={`\u20AC${stats.mrr.toFixed(2)}`}
        />
        <StatCard
          icon={TrendingUp}
          label="Revenue (30d)"
          value={`\u20AC${stats.revenue30d.toFixed(2)}`}
        />
        <StatCard icon={Cpu} label="AI Calls (7d)" value={stats.aiCalls7d} />
      </div>
    </div>
  )
}
