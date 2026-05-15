import { cn } from "@/lib/utils"
import { HugeiconsIcon } from "@hugeicons/react"
import type { Stethoscope02Icon } from "@hugeicons/core-free-icons"

interface SectionHeaderProps {
  icon: typeof Stethoscope02Icon
  title: string
  description?: string
  variant?: "primary" | "accent" | "success" | "warning"
  eyebrow?: string
  action?: React.ReactNode
}

const variantMap = {
  primary: "text-primary",
  accent: "text-accent",
  success: "text-success",
  warning: "text-warning",
} as const

export function SectionHeader({
  icon,
  title,
  description,
  variant = "primary",
  eyebrow,
  action,
}: SectionHeaderProps) {
  const tone = variantMap[variant]
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground/80">
            {eyebrow}
          </p>
        )}
        <div className="flex items-center gap-2.5">
          <span className={cn("inline-flex shrink-0", tone)} aria-hidden>
            <HugeiconsIcon icon={icon} size={16} />
          </span>
          <h2 className="text-[15px] font-semibold tracking-tight text-foreground">{title}</h2>
        </div>
        {description && (
          <p className="mt-1 ps-[26px] text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
