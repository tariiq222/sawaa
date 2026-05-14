"use client"

/**
 * Chart primitives for Employee profile
 * — DonutChart, LineChart, PeriodSelector
 */

import { useLocale } from "@/components/locale-provider"

/* ─── Period Selector ─── */

export type Period = "1m" | "3m" | "6m"

export const PERIOD_KEYS: { key: Period; tKey: string }[] = [
  { key: "1m", tKey: "employees.chart.period1m" },
  { key: "3m", tKey: "employees.chart.period3m" },
  { key: "6m", tKey: "employees.chart.period6m" },
]

export function PeriodSelector({
  value,
  onChange,
}: {
  value: Period
  onChange: (p: Period) => void
  /** @deprecated pass nothing — component uses useLocale() internally */
  isAr?: boolean
}) {
  const { t } = useLocale()
  return (
    <div className="flex items-center gap-1 rounded-lg bg-surface-muted p-0.5">
      {PERIOD_KEYS.map((p) => (
        <button
          key={p.key}
          onClick={() => onChange(p.key)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            value === p.key
              ? "bg-surface text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t(p.tKey)}
        </button>
      ))}
    </div>
  )
}

/* ─── Donut Chart ─── */

export interface DonutSegment { value: number; color: string; label: string }

export function DonutChart({
  segments,
  total,
  emptyLabel,
}: {
  segments: DonutSegment[]
  total: number
  emptyLabel: string
}) {
  const SIZE = 120
  const R = 44
  const C = 2 * Math.PI * R
  const cx = SIZE / 2
  const cy = SIZE / 2

  if (total === 0) {
    return (
      <div className="flex flex-col items-center gap-2">
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          <circle cx={cx} cy={cy} r={R} fill="none" stroke="var(--color-surface-muted)" strokeWidth={14} />
          <text x={cx} y={cy + 5} textAnchor="middle" fontSize="13" fontWeight="600" fill="var(--color-muted-foreground)">0</text>
        </svg>
        <p className="text-xs text-muted-foreground">{emptyLabel}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90">
        {segments.filter((s) => s.value > 0).reduce<{ els: React.ReactElement[]; acc: number }>((state, s, i) => {
          const dash = (s.value / total) * C
          const gap = C - dash
          const el = (
            <circle key={`segment-${i}`} cx={cx} cy={cy} r={R} fill="none"
              stroke={s.color} strokeWidth={14}
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={-state.acc}
              strokeLinecap="butt"
            />
          )
          return { els: [...state.els, el], acc: state.acc + dash }
        }, { els: [], acc: 0 }).els}
        <text
          x={cx} y={cy + 5} textAnchor="middle" fontSize="16" fontWeight="700"
          fill="var(--color-foreground)"
          style={{ transform: "rotate(90deg)", transformOrigin: `${cx}px ${cy}px` }}
        >
          {total}
        </text>
      </svg>
      <div className="grid w-full grid-cols-2 gap-x-4 gap-y-1.5">
        {segments.filter((s) => s.value > 0).map((s) => (
          <div key={s.label} className="flex items-center justify-between gap-1.5">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
              <span className="truncate text-xs text-muted-foreground">{s.label}</span>
            </div>
            <span className="text-xs font-medium tabular-nums text-foreground">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── Line Chart (SVG) ─── */

export interface LinePoint { x: number; y: number; label: string; value: number }

export function LineChart({
  points,
  color,
  height,
  formatValue,
}: {
  points: LinePoint[]
  color: string
  height: number
  formatValue: (v: number) => string
}) {
  if (points.length < 2) return null
  const W = 100
  const H = 100
  const pad = 4
  const maxY = Math.max(...points.map((p) => p.y), 1)
  const id = `grad${color.replace(/[^a-z0-9]/gi, "")}`

  const mapped = points.map((p) => ({
    ...p,
    sx: pad + (p.x / (points.length - 1)) * (W - pad * 2),
    sy: H - pad - (p.y / maxY) * (H - pad * 2),
  }))

  const pathD = mapped.map((p, i) => `${i === 0 ? "M" : "L"} ${p.sx} ${p.sy}`).join(" ")
  const areaD = `${pathD} L ${mapped[mapped.length - 1].sx} ${H} L ${mapped[0].sx} ${H} Z`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ height, width: "100%" }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#${id})`} />
      <path d={pathD} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {mapped.map((p) => (
        <circle key={p.label} cx={p.sx} cy={p.sy} r="1.5" fill={color}>
          <title>{`${p.label}: ${formatValue(p.value)}`}</title>
        </circle>
      ))}
    </svg>
  )
}
