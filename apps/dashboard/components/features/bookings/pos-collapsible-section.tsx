"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { PencilEdit02Icon, ArrowDown01Icon } from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"

/* ─── Types ─── */

export type SectionId = "client" | "service" | "employee" | "typeDuration" | "datetime"

/* ─── Collapsible section ─── */

export function CollapsibleSection({
  id,
  label,
  summary,
  isOpen,
  isFilled,
  onToggle,
  children,
}: {
  id: SectionId
  label: string
  summary: string | null
  isOpen: boolean
  isFilled: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div data-section={id} className="rounded-xl border border-border bg-surface">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-start"
      >
        <div className="flex min-w-0 flex-col">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </span>
          {!isOpen && isFilled && summary && (
            <span className="truncate text-sm font-semibold text-foreground">{summary}</span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {isFilled && (
            <HugeiconsIcon icon={PencilEdit02Icon} size={15} className="text-muted-foreground" />
          )}
          <HugeiconsIcon
            icon={ArrowDown01Icon}
            size={16}
            className={cn("text-muted-foreground transition-transform", isOpen && "rotate-180")}
          />
        </div>
      </button>
      {isOpen && (
        <div className="border-t border-border px-4 pb-4 pt-3">{children}</div>
      )}
    </div>
  )
}

/* ─── Dependency hint ─── */

export function PosSectionHint({ hint }: { hint: string }) {
  return (
    <p className="py-4 text-center text-sm text-muted-foreground">{hint}</p>
  )
}
