"use client"

import { cn } from "@/lib/utils"

interface WizardCardProps {
  onClick: () => void
  selected?: boolean
  disabled?: boolean
  className?: string
  children: React.ReactNode
}

/**
 * Base card for wizard steps. Click to select and advance.
 * Use for both vertical list cards and grid cards.
 */
export function WizardCard({
  onClick,
  selected = false,
  disabled = false,
  className,
  children,
}: WizardCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "group relative w-full rounded-2xl border border-border bg-surface",
        "px-5 py-4 text-end transition-all duration-150",
        "hover:border-primary/60 hover:bg-primary/5 hover:shadow-md",
        "active:scale-[0.97]",
        "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-40",
        selected &&
          "border-primary bg-primary/10 shadow-sm ring-2 ring-primary/20",
        className
      )}
    >
      {children}
    </button>
  )
}
