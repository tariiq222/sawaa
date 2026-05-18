"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { PencilEdit02Icon, ArrowDown01Icon } from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"

/* ─── Types ─── */

export type SectionId = "client" | "service" | "employee" | "typeDuration" | "datetime"

const STEP_NUMBERS: Record<SectionId, number> = {
  client: 1,
  service: 2,
  employee: 3,
  typeDuration: 4,
  datetime: 5,
}

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
        <div className="flex items-center gap-3 min-w-0">
          {/* Step indicator bubble */}
          <div
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all",
              isFilled
                ? "bg-primary text-primary-foreground"
                : isOpen
                  ? "border-2 border-primary text-primary"
                  : "border-2 border-muted-foreground/30 text-muted-foreground/50"
            )}
          >
            {STEP_NUMBERS[id]}
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {label}
            </span>
            {!isOpen && isFilled && summary && (
              <span className="truncate text-sm font-semibold text-foreground">{summary}</span>
            )}
          </div>
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
