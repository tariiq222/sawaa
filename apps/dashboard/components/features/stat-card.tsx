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
  size?: "default" | "lead"
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
  size = "default",
  className,
}: StatCardProps) {
  const tone = iconColorMap[iconColor]
  const isLead = size === "lead"

  return (
    <Card
      className={cn(
        "card-lift relative h-full",
        isLead ? "px-5 py-5" : "px-4 py-3.5",
        className,
      )}
    >
      <div className={cn("flex h-full", isLead ? "flex-col gap-3" : "items-center gap-3")}>
        {icon && (
          <div
            className={cn(
              "flex shrink-0 items-center justify-center rounded-xl",
              tone,
              isLead ? "size-10" : "size-8 rounded-lg",
            )}
            aria-hidden
          >
            <HugeiconsIcon icon={icon} size={isLead ? 20 : 16} />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "font-semibold leading-none tabular-nums text-foreground",
              isLead ? "text-[34px] tracking-tight" : "text-[22px]",
            )}
          >
            <StatValue value={value} />
          </p>
          <p
            className={cn(
              "truncate text-muted-foreground",
              isLead ? "mt-2 text-sm" : "mt-1 text-xs",
            )}
          >
            {title}
            {description && <span className="ms-1 text-muted-foreground/80">· {description}</span>}
          </p>
        </div>

        {trend && (
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
              trend.positive ? "bg-success/10 text-success" : "bg-error/10 text-error",
              isLead && "self-start",
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
