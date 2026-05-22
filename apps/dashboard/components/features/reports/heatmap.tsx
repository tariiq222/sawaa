"use client"

import { useLocale } from "@/components/locale-provider"

interface HeatmapProps {
  /** Each cell is keyed by dow (0=Sun..6=Sat) and hour (0–23) */
  data: Array<{ dow: number; hour: number; count: number }>
}

const HOUR_BUCKETS = [9, 11, 13, 16, 19] as const

const DOW_LABELS_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"]
const DOW_LABELS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const HOUR_LABEL_AR = (h: number) => (h < 12 ? `${h} ص` : h === 12 ? "١٢ ظ" : `${h - 12} م`)
const HOUR_LABEL_EN = (h: number) => `${h}:00`

/** Buckets actual hour count into the nearest displayed slot (within ±1h). */
function bucketByHour(
  cells: HeatmapProps["data"],
): Map<string, number> {
  const out = new Map<string, number>()
  for (const c of cells) {
    let nearest: number = HOUR_BUCKETS[0]
    let best = Math.abs(c.hour - nearest)
    for (const h of HOUR_BUCKETS) {
      const d = Math.abs(c.hour - h)
      if (d < best) {
        best = d
        nearest = h
      }
    }
    const key = `${c.dow}:${nearest}`
    out.set(key, (out.get(key) ?? 0) + c.count)
  }
  return out
}

export function Heatmap({ data }: HeatmapProps) {
  const { locale } = useLocale()
  const isAr = locale === "ar"
  const dowLabels = isAr ? DOW_LABELS_AR : DOW_LABELS_EN
  const hourLabel = isAr ? HOUR_LABEL_AR : HOUR_LABEL_EN

  const bucketed = bucketByHour(data)
  const maxCount = Math.max(0, ...bucketed.values())

  return (
    <div
      className="grid gap-1 text-[11px]"
      style={{ gridTemplateColumns: "60px repeat(7, 1fr)" }}
      data-testid="report-heatmap"
    >
      <div />
      {dowLabels.map((d) => (
        <div key={d} className="text-center font-medium text-muted-foreground">
          {d}
        </div>
      ))}

      {HOUR_BUCKETS.map((h) => (
        <Row key={h} hour={h} label={hourLabel(h)} bucketed={bucketed} max={maxCount} />
      ))}
    </div>
  )
}

function Row({
  hour,
  label,
  bucketed,
  max,
}: {
  hour: number
  label: string
  bucketed: Map<string, number>
  max: number
}) {
  const dows = [0, 1, 2, 3, 4, 5, 6]
  return (
    <>
      <div className="flex items-center text-muted-foreground">{label}</div>
      {dows.map((d) => {
        const count = bucketed.get(`${d}:${hour}`) ?? 0
        const intensity = max > 0 ? count / max : 0
        return (
          <div
            key={d}
            className="aspect-square rounded-md text-center text-[11px] font-medium leading-[2.4] text-foreground"
            style={{
              background:
                count > 0
                  ? `rgba(20, 168, 154, ${0.1 + intensity * 0.9})`
                  : "rgba(20, 168, 154, 0.05)",
            }}
          >
            {count > 0 ? count : "—"}
          </div>
        )
      })}
    </>
  )
}
