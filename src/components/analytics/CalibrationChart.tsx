import type { CalibrationData } from '../../lib/calibration'

interface Props {
  data: CalibrationData[]
}

const SUBJECT_COLORS = [
  '#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6',
  '#8b5cf6', '#ef4444', '#14b8a6', '#f97316', '#06b6d4',
]

export function CalibrationChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-[var(--text-muted)]">
        Answer more questions to see your confidence calibration.
      </p>
    )
  }

  // Assign colors per subject
  const subjectNames = [...new Set(data.map(d => d.subjectName))]
  const colorMap = new Map(subjectNames.map((name, i) => [name, SUBJECT_COLORS[i % SUBJECT_COLORS.length]]))

  const size = 280
  const pad = 40

  return (
    <div>
      <div className="flex justify-center">
        <svg viewBox={`0 0 ${size + pad * 2} ${size + pad * 2}`} className="w-full max-w-[360px]">
          {/* Grid */}
          {[0, 0.25, 0.5, 0.75, 1].map(v => (
            <g key={v}>
              <line
                x1={pad} y1={pad + size - v * size}
                x2={pad + size} y2={pad + size - v * size}
                stroke="var(--border-card)" strokeWidth={0.5}
              />
              <line
                x1={pad + v * size} y1={pad}
                x2={pad + v * size} y2={pad + size}
                stroke="var(--border-card)" strokeWidth={0.5}
              />
              <text x={pad - 6} y={pad + size - v * size + 4} textAnchor="end" fontSize={10} fill="var(--text-faint)">
                {Math.round(v * 100)}%
              </text>
              <text x={pad + v * size} y={pad + size + 14} textAnchor="middle" fontSize={10} fill="var(--text-faint)">
                {Math.round(v * 100)}%
              </text>
            </g>
          ))}

          {/* Perfect calibration diagonal */}
          <line
            x1={pad} y1={pad + size}
            x2={pad + size} y2={pad}
            stroke="var(--accent-text)" strokeWidth={1} strokeDasharray="4 4" opacity={0.4}
          />

          {/* Axis labels */}
          <text x={pad + size / 2} y={pad + size + 30} textAnchor="middle" fontSize={11} fill="var(--text-muted)">
            Mastery
          </text>
          <text
            x={12} y={pad + size / 2}
            textAnchor="middle" fontSize={11} fill="var(--text-muted)"
            transform={`rotate(-90, 12, ${pad + size / 2})`}
          >
            Confidence
          </text>

          {/* Data points */}
          {data.map((d, i) => {
            const cx = pad + d.mastery * size
            const cy = pad + size - d.confidence * size
            const color = colorMap.get(d.subjectName) ?? '#6366f1'
            const isOutlier = Math.abs(d.gap) > 0.3

            return (
              <g key={i}>
                <circle cx={cx} cy={cy} r={5} fill={color} opacity={0.8} />
                {isOutlier && (
                  <text
                    x={cx + 7} y={cy + 3}
                    fontSize={8} fill="var(--text-muted)"
                    className="select-none"
                  >
                    {d.topicName.length > 15 ? d.topicName.slice(0, 15) + '...' : d.topicName}
                  </text>
                )}
              </g>
            )
          })}

          {/* Zone labels */}
          <text x={pad + size * 0.2} y={pad + size * 0.15} fontSize={9} fill="var(--text-faint)" opacity={0.6}>
            Overconfident
          </text>
          <text x={pad + size * 0.65} y={pad + size * 0.9} fontSize={9} fill="var(--text-faint)" opacity={0.6}>
            Underconfident
          </text>
        </svg>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-3 justify-center">
        {subjectNames.map(name => (
          <div key={name} className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colorMap.get(name) }} />
            {name}
          </div>
        ))}
      </div>
    </div>
  )
}
