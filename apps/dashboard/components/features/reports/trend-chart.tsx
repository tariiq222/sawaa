"use client"

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { useLocale } from "@/components/locale-provider"

export interface TrendSeries {
  key: string
  label: string
  color: string
  type?: "area" | "line"
  axis?: "left" | "right"
  unit?: "SAR"
}

interface TrendChartProps {
  data: Array<Record<string, string | number>>
  xKey?: string
  series: TrendSeries[]
  height?: number
  /** Previous-period data overlayed as dashed lines */
  previous?: Array<Record<string, string | number>>
  currentFrom?: string
  previousFrom?: string
}

export function TrendChart({
  data,
  xKey = "date",
  series,
  height = 240,
  previous,
  currentFrom,
  previousFrom,
}: TrendChartProps) {
  const { locale, t } = useLocale()
  const isRTL = locale === "ar"

  const first = currentFrom ?? String(data[0]?.[xKey] ?? "")
  const priorFirst = previousFrom ?? String(previous?.[0]?.[xKey] ?? "")
  const offset = new Date(first).getTime() - new Date(priorFirst).getTime()
  const priorByDate = new Map(previous?.map((row) => [String(row[xKey]), row]))
  const merged = previous
    ? data.map((row) => {
        const previousInstant = new Date(String(row[xKey])).getTime() - offset
        const previousDate = Number.isFinite(previousInstant)
          ? new Date(previousInstant).toISOString().slice(0, 10)
          : ""
        return {
          ...row,
          ...Object.fromEntries(
            series.map((s) => [
              `${s.key}_prev`,
              priorByDate.get(previousDate)?.[s.key] ?? null,
            ])
          ),
        }
      })
    : data
  const moneyFormat = (value: number) =>
    new Intl.NumberFormat(locale === "ar" ? "ar-SA" : "en-US", {
      maximumFractionDigits: 2,
    }).format(value)

  return (
    <div
      data-testid="report-trend-chart"
      style={{ width: "100%", height, direction: "ltr" }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={merged}
          margin={{ top: 8, right: 16, left: 16, bottom: 8 }}
        >
          <defs>
            {series.map((s) => (
              <linearGradient
                key={s.key}
                id={`grad-${s.key}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor={s.color} stopOpacity={0.4} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey={xKey}
            reversed={isRTL}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
          />
          {[...new Set(series.map((s) => s.axis ?? "left"))].map((axis) => (
            <YAxis
              key={axis}
              yAxisId={axis}
              orientation={axis === "right" ? "right" : "left"}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
              width={64}
              tickFormatter={(value) => moneyFormat(Number(value))}
            />
          ))}
          <Tooltip
            formatter={(value, name) => {
              const item = series.find((s) => String(name).startsWith(s.label))
              return [
                item?.unit === "SAR"
                  ? new Intl.NumberFormat(locale === "ar" ? "ar-SA" : "en-US", {
                      style: "currency",
                      currency: "SAR",
                      minimumFractionDigits: 2,
                    }).format(Number(value))
                  : value,
                name,
              ]
            }}
            contentStyle={{
              borderRadius: 8,
              border: "1px solid var(--border)",
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {series.map((s) =>
            s.type === "line" ? (
              <Line
                key={s.key}
                type="monotone"
                yAxisId={s.axis ?? "left"}
                dataKey={s.key}
                stroke={s.color}
                strokeWidth={2}
                dot={false}
                name={s.label}
              />
            ) : (
              <Area
                key={s.key}
                type="monotone"
                yAxisId={s.axis ?? "left"}
                dataKey={s.key}
                stroke={s.color}
                strokeWidth={2}
                fill={`url(#grad-${s.key})`}
                name={s.label}
              />
            )
          )}
          {previous &&
            series.map((s) => (
              <Line
                key={`${s.key}-prev`}
                type="monotone"
                yAxisId={s.axis ?? "left"}
                dataKey={`${s.key}_prev`}
                stroke="var(--muted-foreground)"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                name={`${s.label} (${t("reports.previousPeriod")})`}
              />
            ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
