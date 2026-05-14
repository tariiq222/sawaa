"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@deqah/ui"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@deqah/ui"
import { Button } from "@deqah/ui"
import { Badge } from "@deqah/ui"
import { useLocale } from "@/components/locale-provider"
import { useContactMessages, useUpdateContactMessageStatus } from "@/hooks/use-contact-messages"
import { ErrorBanner } from "@/components/features/error-banner"
import { formatLocaleDate } from "@/lib/date"
import type { ContactMessageStatus } from "@/lib/api/contact-messages"
import { useState } from "react"

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

  return (
    <div className="space-y-4">
      {error && <ErrorBanner message={(error as Error).message} />}

      <div className="flex gap-2">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as ContactMessageStatus | "ALL")}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {t(opt.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("contactMessages.table.name")}</TableHead>
            <TableHead>{t("contactMessages.table.contact")}</TableHead>
            <TableHead>{t("contactMessages.table.subject")}</TableHead>
            <TableHead>{t("contactMessages.table.body")}</TableHead>
            <TableHead>{t("contactMessages.table.status")}</TableHead>
            <TableHead>{t("contactMessages.table.date")}</TableHead>
            <TableHead>{t("contactMessages.table.actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">
                {t("contactMessages.loading")}
              </TableCell>
            </TableRow>
          )}
          {!isLoading &&
            data?.items?.map((msg) => (
              <TableRow key={msg.id}>
                <TableCell className="font-medium">{msg.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {msg.email ?? msg.phone ?? "—"}
                </TableCell>
                <TableCell>{msg.subject ?? "—"}</TableCell>
                <TableCell className="max-w-xs truncate">{msg.body}</TableCell>
                <TableCell>
                  <Badge variant={msg.status === "NEW" ? "default" : "secondary"}>{msg.status}</Badge>
                </TableCell>
                <TableCell className="text-sm tabular-nums">
                  {formatLocaleDate(msg.createdAt, locale, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {msg.status === "NEW" && (
                      <Button size="sm" variant="outline" onClick={() => update.mutate({ id: msg.id, status: "READ" })}>
                        {t("contactMessages.actions.markRead")}
                      </Button>
                    )}
                    {msg.status !== "REPLIED" && msg.status !== "ARCHIVED" && (
                      <Button size="sm" variant="outline" onClick={() => update.mutate({ id: msg.id, status: "REPLIED" })}>
                        {t("contactMessages.actions.markReplied")}
                      </Button>
                    )}
                    {msg.status !== "ARCHIVED" && (
                      <Button size="sm" variant="ghost" onClick={() => update.mutate({ id: msg.id, status: "ARCHIVED" })}>
                        {t("contactMessages.actions.archive")}
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          {!isLoading && (data?.items?.length ?? 0) === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">
                {t("contactMessages.empty")}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
