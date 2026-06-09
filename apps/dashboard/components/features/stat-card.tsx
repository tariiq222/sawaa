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

/* Icon tile: vivid soft background, full-saturation icon, subtle ring + colored
   shadow so the icon reads as the visual anchor of the card. The shadow uses
   the same hue as the icon at low alpha — depth without looking heavy. */
const iconColorMap = {
  primary: "bg-primary-ultra-light text-primary ring-1 ring-primary/15 shadow-[0_4px_12px_rgba(85,204,176,0.18)]",
  accent:  "bg-accent-ultra-light text-accent ring-1 ring-accent/20 shadow-[0_4px_12px_rgba(231,219,196,0.35)]",
  warning: "bg-warning-soft text-warning ring-1 ring-warning/20 shadow-[0_4px_12px_rgba(194,65,12,0.15)]",
  success: "bg-success-soft text-success ring-1 ring-success/20 shadow-[0_4px_12px_rgba(21,128,61,0.15)]",
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
              "flex size-11 shrink-0 items-center justify-center rounded-xl",
              tone,
            )}
            aria-hidden
          >
            <HugeiconsIcon icon={icon} size={20} strokeWidth={2.2} />
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
              "inline-flex shrink-0 items-center gap-1 self-start rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums border-s-[3px]",
              trend.positive
                ? "bg-success-soft text-success border-s-success border-success/30"
                : "bg-error-soft text-error border-s-error border-error/30",
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
