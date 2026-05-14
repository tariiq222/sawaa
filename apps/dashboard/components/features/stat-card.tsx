import { type ReactNode } from "react"
import { Card } from "@deqah/ui"
import { cn } from "@/lib/utils"
import { HugeiconsIcon } from "@hugeicons/react"
import type { IconSvgElement } from "@hugeicons/react"

function StatValue({ value }: { value: ReactNode }) {
  if (typeof value === "number") {
    return <span className="font-numeric">{value.toLocaleString("en-US")}</span>
  }
  return <>{value}</>
}

interface StatCardProps {
  title: string
  value: ReactNode
  description?: ReactNode
  icon?: IconSvgElement
  trend?: { value: string; positive: boolean }
  iconColor?: "primary" | "accent" | "warning" | "success"
  className?: string
}

const iconColorMap = {
  primary: { bg: "bg-primary/10 text-primary", decorative: "bg-primary" },
  accent:  { bg: "bg-accent/10 text-accent",   decorative: "bg-accent" },
  warning: { bg: "bg-warning/10 text-warning",  decorative: "bg-warning" },
  success: { bg: "bg-success/10 text-success",  decorative: "bg-success" },
} as const

export function StatCard({
  title,
  value,
  description,
  icon,
  trend,
  iconColor = "primary",
  className,
}: StatCardProps) {
  const colors = iconColorMap[iconColor]

  return (
    <Card className={cn("card-lift relative overflow-hidden px-4 py-3", className)}>
      {/* Decorative circle */}
      <div
        className={cn(
          "absolute -top-4 -end-4 size-16 rounded-full opacity-[0.08]",
          colors.decorative
        )}
      />

      <div className="flex items-center gap-3">
        {/* Icon */}
        {icon && (
          <div
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-[8px]",
              colors.bg
            )}
          >
            <HugeiconsIcon icon={icon} size={16} />
          </div>
        )}

        {/* Value + label */}
        <div className="min-w-0 flex-1">
          <p className="text-[22px] font-bold leading-none tabular-nums text-foreground">
            <StatValue value={value} />
          </p>
          <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
            {title}
            {description && <span className="ms-1">· {description}</span>}
          </p>
        </div>

        {/* Trend (end) */}
        {trend && (
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
              trend.positive
                ? "bg-success/10 text-success"
                : "bg-error/10 text-error"
            )}
          >
            {trend.positive ? "↑" : "↓"}
            {trend.value}
          </span>
        )}
      </div>
    </Card>
  )
}
