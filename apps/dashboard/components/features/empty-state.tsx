import { cn } from "@/lib/utils"
import { HugeiconsIcon } from "@hugeicons/react"
import { InboxIcon } from "@hugeicons/core-free-icons"
import type { IconSvgElement } from "@hugeicons/react"
import { Button } from "@deqah/ui"

interface EmptyStateProps {
  icon?: IconSvgElement
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
  iconColor?: "primary" | "accent" | "warning" | "success" | "error" | "info"
  className?: string
}

const iconColorMap = {
  primary: { bg: "bg-primary/10", text: "text-primary" },
  accent:  { bg: "bg-accent/10",  text: "text-accent" },
  warning: { bg: "bg-warning/10", text: "text-warning" },
  success: { bg: "bg-success/10", text: "text-success" },
  error:   { bg: "bg-error/10",   text: "text-error" },
  info:    { bg: "bg-info/10",    text: "text-info" },
} as const

export function EmptyState({
  icon = InboxIcon,
  title,
  description,
  action,
  iconColor = "primary",
  className,
}: EmptyStateProps) {
  const colors = iconColorMap[iconColor]
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 text-center", className)}>
      <div className={cn("flex size-12 items-center justify-center rounded-lg", colors.bg)}>
        <HugeiconsIcon icon={icon} size={24} className={colors.text} />
      </div>
      <h3 className="mt-4 text-sm font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      )}
      {action && (
        <Button onClick={action.onClick} className="mt-4" size="sm">
          {action.label}
        </Button>
      )}
    </div>
  )
}
