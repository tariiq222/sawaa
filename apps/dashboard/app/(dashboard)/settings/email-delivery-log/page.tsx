"use client"

import { useState } from "react"
import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { Badge } from "@sawaa/ui"
import { DataTable } from "@/components/features/data-table"
import { FilterBar } from "@/components/features/filter-bar"
import { useDeliveryLogs } from "@/hooks/use-delivery-logs"
import { useLocale } from "@/components/locale-provider"
import type { ColumnDef } from "@tanstack/react-table"
import type { DeliveryLogItem } from "@/lib/api/delivery-logs"

const STATUS_OPTIONS = ["PENDING", "SENT", "FAILED", "SKIPPED"]
const CHANNEL_OPTIONS = ["EMAIL", "SMS", "PUSH"]
// Radix Select forbids an empty-string item value; use a sentinel for "all".
const ALL = "all"

function statusVariant(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "SENT") return "default"
  if (status === "FAILED") return "destructive"
  return "secondary"
}

export default function EmailDeliveryLogPage() {
  const { t } = useLocale()
  const [status, setStatus] = useState<string | undefined>()
  const [channel, setChannel] = useState<string | undefined>()
  const [page, setPage] = useState(1)

  const { data, isLoading } = useDeliveryLogs({ status, channel, page, perPage: 20 })

  const hasFilters = !!(status || channel)

  const resetFilters = () => {
    setStatus(undefined)
    setChannel(undefined)
    setPage(1)
  }

  const columns: ColumnDef<DeliveryLogItem>[] = [
    {
      accessorKey: "channel",
      header: t("settings.deliveryLog.colChannel"),
    },
    {
      accessorKey: "status",
      header: t("settings.deliveryLog.colStatus"),
      cell: ({ row }) => (
        <Badge variant={statusVariant(row.original.status)} className="text-xs">
          {row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: "toAddress",
      header: t("settings.deliveryLog.colTo"),
      cell: ({ row }) => (
        <span className="block max-w-[180px] truncate text-muted-foreground">
          {row.original.toAddress ?? "—"}
        </span>
      ),
    },
    {
      accessorKey: "providerName",
      header: t("settings.deliveryLog.colProvider"),
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.providerName ?? "—"}</span>
      ),
    },
    {
      accessorKey: "attempts",
      header: t("settings.deliveryLog.colAttempts"),
    },
    {
      accessorKey: "sentAt",
      header: t("settings.deliveryLog.colSentAt"),
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {row.original.sentAt
            ? new Date(row.original.sentAt).toLocaleDateString("ar-SA", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })
            : "—"}
        </span>
      ),
    },
  ]

  return (
    <ListPageShell>
      <Breadcrumbs />
      <PageHeader
        title={t("settings.deliveryLog.title")}
        description={t("settings.deliveryLog.description")}
      />

      <FilterBar
        selects={[
          {
            key: "status",
            value: status ?? ALL,
            placeholder: t("settings.deliveryLog.filterStatus"),
            options: [
              { value: ALL, label: t("settings.deliveryLog.filterStatus") },
              ...STATUS_OPTIONS.map((s) => ({ value: s, label: s })),
            ],
            onValueChange: (v) => {
              setStatus(v === ALL ? undefined : v)
              setPage(1)
            },
            width: "w-40",
          },
          {
            key: "channel",
            value: channel ?? ALL,
            placeholder: t("settings.deliveryLog.filterChannel"),
            options: [
              { value: ALL, label: t("settings.deliveryLog.filterChannel") },
              ...CHANNEL_OPTIONS.map((c) => ({ value: c, label: c })),
            ],
            onValueChange: (v) => {
              setChannel(v === ALL ? undefined : v)
              setPage(1)
            },
            width: "w-40",
          },
        ]}
        hasFilters={hasFilters}
        onReset={resetFilters}
        className="mb-4"
      />

      <DataTable
        columns={columns}
        data={isLoading ? [] : (data?.items ?? [])}
        emptyTitle={t("settings.deliveryLog.noLogs")}
        serverPaginated
        page={page}
        totalPages={data?.meta.totalPages ?? 1}
        hasPreviousPage={page > 1}
        hasNextPage={page < (data?.meta.totalPages ?? 1)}
        onPageChange={setPage}
      />
    </ListPageShell>
  )
}
