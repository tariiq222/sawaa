"use client"

import { useState } from "react"
import { Skeleton } from "@sawaa/ui"
import { useLocale } from "@/components/locale-provider"
import { useContactMessages, useUpdateContactMessageStatus } from "@/hooks/use-contact-messages"
import { ErrorBanner } from "@/components/features/error-banner"
import { DataTable } from "@/components/features/data-table"
import { FilterBar } from "@/components/features/filter-bar"
import { getContactMessageColumns } from "./contact-message-columns"
import type { ContactMessageStatus } from "@/lib/api/contact-messages"

const STATUS_OPTIONS: { value: ContactMessageStatus | "ALL"; labelKey: string }[] = [
  { value: "ALL", labelKey: "contactMessages.status.all" },
  { value: "NEW", labelKey: "contactMessages.status.new" },
  { value: "READ", labelKey: "contactMessages.status.read" },
  { value: "REPLIED", labelKey: "contactMessages.status.replied" },
  { value: "ARCHIVED", labelKey: "contactMessages.status.archived" },
]

export function ContactMessagesTable() {
  const { locale, t } = useLocale()
  const [statusFilter, setStatusFilter] = useState<ContactMessageStatus | "ALL">("ALL")

  const { data, isLoading, error } = useContactMessages({
    status: statusFilter === "ALL" ? undefined : statusFilter,
    limit: 50,
  })
  const update = useUpdateContactMessageStatus()

  const columns = getContactMessageColumns({
    locale,
    t,
    onUpdate: (id, status) => update.mutate({ id, status }),
  })

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-12 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <ErrorBanner message={(error as Error).message} />}

      <FilterBar
        selects={[
          {
            key: "status",
            value: statusFilter,
            placeholder: t("contactMessages.status.all"),
            options: STATUS_OPTIONS.map((opt) => ({
              value: opt.value,
              label: t(opt.labelKey),
            })),
            onValueChange: (v) => setStatusFilter(v as ContactMessageStatus | "ALL"),
            width: "w-44",
          },
        ]}
        hasFilters={statusFilter !== "ALL"}
        onReset={() => setStatusFilter("ALL")}
        resultCount={
          data?.items != null
            ? t("contactMessages.resultCount").replace("{n}", String(data.items.length))
            : undefined
        }
      />

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        emptyTitle={t("contactMessages.empty")}
        emptyDescription={t("contactMessages.empty.description")}
      />
    </div>
  )
}
