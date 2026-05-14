import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import { cn } from "@/lib/utils"

/**
 * Section heading inside a detail sheet.
 * Groups related rows under a label.
 */
export function DetailSection({
  title,
  children,
  className,
}: {
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      <h4 className="text-sm font-bold text-foreground">
        {title}
      </h4>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  )
}

/**
 * Key-value row inside a DetailSection.
 * Label on the start side, value on the end side.
 */
export function DetailRow({
  label,
  value,
  numeric,
  icon,
}: {
  label: string
  value: React.ReactNode
  numeric?: boolean
  icon?: IconSvgElement
}) {
  return (
    <div className="flex items-center gap-2">
      {icon ? (
        <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/8 text-primary">
          <HugeiconsIcon icon={icon} size={13} />
        </span>
      ) : (
        <span className="text-sm text-muted-foreground shrink-0">{label}:</span>
      )}
      <span
        className={cn(
          "text-sm font-medium text-foreground",
          numeric && "tabular-nums",
        )}
      >
        {value}
      </span>
    </div>
  )
}
