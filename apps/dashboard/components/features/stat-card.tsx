import { type ReactNode } from "react"
import { Card } from "@sawaa/ui"
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
  primary: "bg-primary/10 text-primary",
  accent: "bg-accent/12 text-accent",
  warning: "bg-warning/10 text-warning",
  success: "bg-success/10 text-success",
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
  const tone = iconColorMap[iconColor]

  return (
    <Card className={cn("card-lift relative h-full px-4 py-4", className)}>
      <div className="flex h-full items-center gap-3">
        {icon && (
          <div
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-xl",
              tone,
            )}
            aria-hidden
          >
            <HugeiconsIcon icon={icon} size={20} />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="text-[26px] font-semibold leading-none tabular-nums text-foreground">
            <StatValue value={value} />
          </p>
          <p className="mt-1.5 truncate text-xs text-muted-foreground">
            {title}
            {description && (
              <span className="ms-1 text-muted-foreground/80">· {description}</span>
            )}
          </p>
        </div>

        {trend && (
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1 self-start rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
              trend.positive ? "bg-success/10 text-success" : "bg-error/10 text-error",
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
