"use client"

import { useState } from "react"
import { ErrorBanner } from "@/components/features/error-banner"
import { EmptyState } from "@/components/features/empty-state"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deqah/ui"
import { Clock01Icon } from "@hugeicons/core-free-icons"
import { useWaitlist } from "@/hooks/use-waitlist"
import { useWaitlistMutations } from "@/hooks/use-waitlist"
import { useLocale } from "@/components/locale-provider"
import type { WaitlistEntry, WaitlistStatus } from "@/lib/types/waitlist"

const statusStyles: Record<
  WaitlistStatus,
  { labelKey: string; className: string }
> = {
  waiting: {
    labelKey: "waitlist.status.waiting",
    className: "border-warning/20 bg-warning/10 text-warning",
  },
  notified: {
    labelKey: "waitlist.status.notified",
    className: "border-info/20 bg-info/10 text-info",
  },
  booked: {
    labelKey: "waitlist.status.booked",
    className: "border-success/20 bg-success/10 text-success",
  },
  expired: {
    labelKey: "waitlist.status.expired",
    className: "border-muted-foreground/20 bg-muted text-muted-foreground",
  },
  cancelled: {
    labelKey: "waitlist.status.cancelled",
    className: "border-muted-foreground/20 bg-muted text-muted-foreground",
  },
}

interface WaitlistEntryCardProps {
  entry: WaitlistEntry
  t: (key: string) => string
}

function WaitlistEntryCard({ entry, t }: WaitlistEntryCardProps) {
  const preferredDateStr =
    entry.preferredDate
      ? new Date(entry.preferredDate).toLocaleDateString("ar-SA", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : "—"

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="font-medium">
          {entry.client.firstName} {entry.client.lastName}
        </p>
        <p className="text-sm text-muted-foreground">
          {entry.service?.nameAr ?? "—"}
        </p>
      </div>
      <div className="text-right">
        <span
          className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusStyles[entry.status].className}`}
        >
          {t(statusStyles[entry.status].labelKey)}
        </span>
        <p className="text-sm text-muted-foreground mt-1">{preferredDateStr}</p>
      </div>
    </div>
  )
}

export function WaitlistTab() {
  const { t } = useLocale()
  const [statusFilter, setStatusFilter] = useState<string>("all")

  const { data, isLoading, error } = useWaitlist(
    statusFilter === "all" ? undefined : statusFilter
  )

  // keep mutations hook available for add-to-waitlist actions
  useWaitlistMutations()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder={t("waitlist.allStatuses")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("waitlist.allStatuses")}</SelectItem>
            <SelectItem value="waiting">{t("waitlist.status.waiting")}</SelectItem>
            <SelectItem value="notified">{t("waitlist.status.notified")}</SelectItem>
            <SelectItem value="booked">{t("waitlist.status.booked")}</SelectItem>
            <SelectItem value="expired">{t("waitlist.status.expired")}</SelectItem>
            <SelectItem value="cancelled">{t("waitlist.status.cancelled")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error && (
        <ErrorBanner
          message={error.message || t("common.errors.somethingWentWrong")}
        />
      )}

      {isLoading && (
        <div className="flex flex-col gap-3">
          <div className="h-16 animate-pulse rounded-xl bg-muted" />
          <div className="h-16 animate-pulse rounded-xl bg-muted" />
          <div className="h-16 animate-pulse rounded-xl bg-muted" />
        </div>
      )}

      {!isLoading && (!data || data.length === 0) && (
        <EmptyState
          icon={Clock01Icon}
          title={t("waitlist.empty.title")}
          description={t("waitlist.empty.description")}
        />
      )}

      {!isLoading && data && data.length > 0 && (
        <div className="flex flex-col gap-3">
          {data.map((entry) => (
            <WaitlistEntryCard key={entry.id} entry={entry} t={t} />
          ))}
        </div>
      )}
    </div>
  )
}
