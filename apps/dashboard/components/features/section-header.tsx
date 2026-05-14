import { cn } from "@/lib/utils"
import { HugeiconsIcon } from "@hugeicons/react"
import type { Stethoscope02Icon } from "@hugeicons/core-free-icons"

interface SectionHeaderProps {
  icon: typeof Stethoscope02Icon
  title: string
  description?: string
  variant?: "primary" | "accent" | "success" | "warning"
}

const variantMap = {
  primary: { bg: "bg-primary/10", text: "text-primary" },
  accent:  { bg: "bg-accent/10",  text: "text-accent" },
  success: { bg: "bg-success/10", text: "text-success" },
  warning: { bg: "bg-warning/10", text: "text-warning" },
} as const

export function SectionHeader({ icon, title, description, variant = "primary" }: SectionHeaderProps) {
  const colors = variantMap[variant]
  return (
    <div className="flex items-center gap-2.5">
      <div className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg", colors.bg)}>
        <HugeiconsIcon icon={icon} size={15} className={colors.text} />
      </div>
      <div>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
    </div>
  )
}
