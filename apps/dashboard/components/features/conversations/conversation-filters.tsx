"use client"

import { Input } from "@sawaa/ui"
import { HugeiconsIcon } from "@hugeicons/react"
import { Search01Icon } from "@hugeicons/core-free-icons"
import type { ConversationFilters, ConversationStatus } from "@/lib/types/conversations"

const STATUSES: ConversationStatus[] = [
  "WAITING_FOR_STAFF", "STAFF_ACTIVE", "AI_ACTIVE", "CLOSED",
]

interface ConversationFilterControlsProps {
  filters: ConversationFilters
  t: (key: string) => string
  onChange: (filters: ConversationFilters) => void
}

const dateValue = (value?: string) => value?.slice(0, 10) ?? ""
const dateBoundary = (value: string, endOfDay: boolean) => value
  ? `${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`
  : undefined

export function ConversationFilterControls(props: ConversationFilterControlsProps) {
  const { filters, t } = props
  const update = (next: Partial<ConversationFilters>) => props.onChange({ ...filters, ...next, cursor: undefined })

  return (
    <div className="space-y-3">
      <div className="relative">
        <HugeiconsIcon icon={Search01Icon} size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input value={filters.search ?? ""} className="bg-surface-solid ps-9" aria-label={t("conversations.search")} placeholder={t("conversations.search")} onChange={(event) => update({ search: event.target.value || undefined })} />
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("conversations.filter.label")}>
        <FilterButton active={!filters.status} onClick={() => update({ status: undefined })}>{t("conversations.filter.all")}</FilterButton>
        {STATUSES.map((status) => (
          <FilterButton key={status} active={filters.status === status} onClick={() => update({ status })}>{t(`conversations.status.${status}`)}</FilterButton>
        ))}
        <FilterButton active={filters.unreadOnly === true} onClick={() => update({ unreadOnly: filters.unreadOnly ? undefined : true })}>{t("conversations.filter.unread")}</FilterButton>
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("conversations.filter.assignment")}>
        {(["all", "me", "unassigned"] as const).map((assigned) => (
          <FilterButton key={assigned} active={(filters.assigned ?? "all") === assigned} onClick={() => update({ assigned })}>{t(`conversations.filter.assignment.${assigned}`)}</FilterButton>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input dir="ltr" type="date" value={dateValue(filters.from)} aria-label={t("conversations.filter.from")} onChange={(event) => update({ from: dateBoundary(event.target.value, false) })} />
        <Input dir="ltr" type="date" value={dateValue(filters.to)} aria-label={t("conversations.filter.to")} onChange={(event) => update({ to: dateBoundary(event.target.value, true) })} />
      </div>
    </div>
  )
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" aria-pressed={active} onClick={onClick} className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface-solid text-muted-foreground hover:border-primary/40"}`}>{children}</button>
}
