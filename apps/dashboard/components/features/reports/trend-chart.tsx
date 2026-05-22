"use client"

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
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
}

interface TrendChartProps {
  data: Array<Record<string, string | number>>
  xKey?: string
  series: TrendSeries[]
  height?: number
  /** Previous-period data overlayed as dashed lines */
  previous?: Array<Record<string, string | number>>
}

export function TrendChart({
  data,
  xKey = "date",
  series,
  height = 240,
  previous,
}: TrendChartProps) {
  const { locale } = useLocale()
  const isRTL = locale === "ar"

  const merged = previous
    ? data.map((row, i) => ({
        ...row,
        ...Object.fromEntries(
          series.map((s) => [
            `${s.key}_prev`,
            (previous[i]?.[s.key] as number) ?? 0,
          ]),
        ),
      }))
    : data

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
          <CartesianGrid strokeDasharray="3 3" stroke="#E4E7EC" />
          <XAxis
            dataKey={xKey}
            reversed={isRTL}
            tick={{ fontSize: 11, fill: "#667085" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            orientation={isRTL ? "right" : "left"}
            tick={{ fontSize: 11, fill: "#667085" }}
            axisLine={false}
            tickLine={false}
            width={50}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 8,
              border: "1px solid #E4E7EC",
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {series.map((s) =>
            s.type === "line" ? (
              <Line
                key={s.key}
                type="monotone"
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
                dataKey={s.key}
                stroke={s.color}
                strokeWidth={2}
                fill={`url(#grad-${s.key})`}
                name={s.label}
              />
            ),
          )}
          {previous &&
            series.map((s) => (
              <Line
                key={`${s.key}-prev`}
                type="monotone"
                dataKey={`${s.key}_prev`}
                stroke="#D0D5DD"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                name={`${s.label} (سابق)`}
              />
            ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export function MiniLineChart({
  data,
  dataKey,
  color,
  height = 60,
}: {
  data: Array<Record<string, string | number>>
  dataKey: string
  color: string
  height?: number
}) {
  return (
    <div style={{ width: "100%", height, direction: "ltr" }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
