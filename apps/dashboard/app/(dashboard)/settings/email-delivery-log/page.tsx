"use client"

import { useState } from "react"
import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { Badge } from "@sawaa/ui"
import { Button } from "@sawaa/ui"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@sawaa/ui"
import { Skeleton } from "@sawaa/ui"
import { useDeliveryLogs } from "@/hooks/use-delivery-logs"
import { useLocale } from "@/components/locale-provider"

const STATUS_OPTIONS = ["PENDING", "SENT", "FAILED", "SKIPPED"]
const CHANNEL_OPTIONS = ["EMAIL", "SMS", "PUSH"]

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

  const resetFilters = () => {
    setStatus(undefined)
    setChannel(undefined)
    setPage(1)
  }

  return (
    <ListPageShell>
      <Breadcrumbs />
      <PageHeader
        title={t("settings.deliveryLog.title")}
        description={t("settings.deliveryLog.description")}
      />

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl border border-border/60 bg-surface/60 backdrop-blur-sm mb-4">
        <Select
          value={status ?? ""}
          onValueChange={(v) => {
            setStatus(v || undefined)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder={t("settings.deliveryLog.filterStatus")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{t("settings.deliveryLog.filterStatus")}</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={channel ?? ""}
          onValueChange={(v) => {
            setChannel(v || undefined)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder={t("settings.deliveryLog.filterChannel")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{t("settings.deliveryLog.filterChannel")}</SelectItem>
            {CHANNEL_OPTIONS.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(status || channel) && (
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            Reset
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border/60 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                {t("settings.deliveryLog.colChannel")}
              </th>
              <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                {t("settings.deliveryLog.colStatus")}
              </th>
              <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                {t("settings.deliveryLog.colTo")}
              </th>
              <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                {t("settings.deliveryLog.colProvider")}
              </th>
              <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                {t("settings.deliveryLog.colAttempts")}
              </th>
              <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                {t("settings.deliveryLog.colSentAt")}
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`row-${i}`} className="border-t border-border/40">
                    <td colSpan={6} className="px-4 py-3">
                      <Skeleton className="h-5 w-full" />
                    </td>
                  </tr>
                ))
              : data?.items.length === 0
                ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      {t("settings.deliveryLog.noLogs")}
                    </td>
                  </tr>
                )
                : data?.items.map((log) => (
                  <tr
                    key={log.id}
                    className="border-t border-border/40 hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-4 py-3">{log.channel}</td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={statusVariant(log.status)}
                        className="text-xs"
                      >
                        {log.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground truncate max-w-[180px]">
                      {log.toAddress ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {log.providerName ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-center">{log.attempts}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {log.sentAt
                        ? new Date(log.sentAt).toLocaleDateString("ar-SA", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })
                        : "—"}
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && data.meta.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
          <span>
            {data.meta.page} / {data.meta.totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= data.meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </ListPageShell>
  )
}
