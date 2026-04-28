/**
 * SVG line chart showing mastery over time for a specific topic.
 * Follows CalibrationChart.tsx pattern (280×200 canvas, CSS variables).
 */

interface DataPoint {
  date: string
  mastery: number
}

interface Props {
  data: DataPoint[]
  topicName: string
}

export function MasteryTrendChart({ data, topicName }: Props) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-[var(--text-muted)]">
        No mastery data recorded yet for {topicName}. Study this topic to start tracking.
      </p>
    )
  }

  const width = 280
  const height = 200
  const pad = { top: 20, right: 20, bottom: 30, left: 40 }
  const chartW = width - pad.left - pad.right
  const chartH = height - pad.top - pad.bottom

  // Compute change annotation
  const first = data[0].mastery
  const last = data[data.length - 1].mastery
  const changePct = Math.round((last - first) * 100)
  const changeLabel = changePct >= 0
    ? `+${changePct}% since ${data.length} day${data.length === 1 ? '' : 's'} ago`
    : `${changePct}% since ${data.length} day${data.length === 1 ? '' : 's'} ago`

  // Map data to SVG coordinates
  const points = data.map((d, i) => ({
    x: pad.left + (data.length === 1 ? chartW / 2 : (i / (data.length - 1)) * chartW),
    y: pad.top + chartH - d.mastery * chartH,
  }))

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

  // Area fill path
  const areaD = `${pathD} L ${points[points.length - 1].x} ${pad.top + chartH} L ${points[0].x} ${pad.top + chartH} Z`

  // Y-axis labels
  const yTicks = [0, 0.25, 0.5, 0.75, 1]

  // X-axis labels (show first, middle, last)
  const xLabels: Array<{ x: number; label: string }> = []
  if (data.length >= 1) {
    xLabels.push({ x: points[0].x, label: formatDate(data[0].date) })
  }
  if (data.length >= 3) {
    const mid = Math.floor(data.length / 2)
    xLabels.push({ x: points[mid].x, label: formatDate(data[mid].date) })
  }
  if (data.length >= 2) {
    xLabels.push({ x: points[points.length - 1].x, label: formatDate(data[data.length - 1].date) })
  }

  return (
    <div>
      <div className="flex justify-center">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-[400px]">
          {/* Grid lines */}
          {yTicks.map(v => (
            <g key={v}>
              <line
                x1={pad.left} y1={pad.top + chartH - v * chartH}
                x2={pad.left + chartW} y2={pad.top + chartH - v * chartH}
                stroke="var(--border-card)" strokeWidth={0.5}
              />
              <text
                x={pad.left - 6}
                y={pad.top + chartH - v * chartH + 3}
                textAnchor="end" fontSize={9} fill="var(--text-faint)"
              >
                {Math.round(v * 100)}%
              </text>
            </g>
          ))}

          {/* Area fill */}
          <path d={areaD} fill="var(--accent-text)" opacity={0.1} />

          {/* Line */}
          <path d={pathD} fill="none" stroke="var(--accent-text)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

          {/* Data points */}
          {points.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={2.5} fill="var(--accent-text)" />
          ))}

          {/* X-axis labels */}
          {xLabels.map((l, i) => (
            <text key={i} x={l.x} y={pad.top + chartH + 14} textAnchor="middle" fontSize={8} fill="var(--text-faint)">
              {l.label}
            </text>
          ))}
        </svg>
      </div>

      {/* Change annotation */}
      <p className={`text-center text-xs mt-1 ${changePct >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'}`}>
        {changeLabel}
      </p>
    </div>
  )
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
