interface Props {
  value: number // 0-100
  label?: string
}

export function ReadinessGauge({ value, label = 'Readiness' }: Props) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)))
  const radius = 60
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (clamped / 100) * circumference
  const color = clamped >= 80 ? 'var(--accent-text)' : clamped >= 50 ? '#f59e0b' : '#ef4444'

  return (
    <div className="flex flex-col items-center">
      <svg width="160" height="160" className="-rotate-90">
        <circle
          cx="80" cy="80" r={radius}
          fill="none"
          stroke="var(--border-card)"
          strokeWidth="10"
        />
        <circle
          cx="80" cy="80" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center" style={{ marginTop: '40px' }}>
        <span className="text-3xl font-bold text-[var(--text-heading)]">{clamped}%</span>
        <span className="text-xs text-[var(--text-muted)]">{label}</span>
      </div>
    </div>
  )
}
