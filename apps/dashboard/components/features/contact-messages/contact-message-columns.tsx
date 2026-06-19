"use client"

import { type ColumnDef } from "@tanstack/react-table"
import { Badge } from "@sawaa/ui"
import { Button } from "@sawaa/ui"
import { contactMessageStatusStyles } from "@/lib/ds"
import { cn } from "@/lib/utils"
import { formatLocaleDate } from "@/lib/date"
import type { ContactMessage, ContactMessageStatus } from "@/lib/api/contact-messages"

interface ColumnContext {
  locale: "ar" | "en"
  t: (key: string) => string
  onUpdate: (id: string, status: ContactMessageStatus) => void
}

export function getContactMessageColumns(
  ctx: ColumnContext,
): ColumnDef<ContactMessage, unknown>[] {
  const { locale, t, onUpdate } = ctx

  return [
    {
      accessorKey: "name",
      header: t("contactMessages.table.name"),
      cell: ({ row }) => (
        <span className={row.original.status === "NEW" ? "font-semibold text-foreground" : "font-medium text-foreground"}>
          {row.original.name}
        </span>
      ),
    },
    {
      accessorKey: "email",
      header: t("contactMessages.table.contact"),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.email ?? row.original.phone ?? "—"}
        </span>
      ),
    },
    {
      accessorKey: "subject",
      header: t("contactMessages.table.subject"),
      cell: ({ row }) => (
        <span className="text-sm">{row.original.subject ?? "—"}</span>
      ),
    },
    {
      accessorKey: "body",
      header: t("contactMessages.table.body"),
      cell: ({ row }) => (
        <span className="max-w-xs truncate text-sm text-muted-foreground block">
          {row.original.body}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: t("contactMessages.table.status"),
      cell: ({ row }) => {
        const s = row.original.status
        const styles = contactMessageStatusStyles[s]
        return (
          <Badge
            variant="outline"
            className={cn(styles?.bg, styles?.text, styles?.border)}
          >
            {t(`contactMessages.status.${s.toLowerCase()}`)}
          </Badge>
        )
      },
    },
    {
      accessorKey: "createdAt",
      header: t("contactMessages.table.date"),
      cell: ({ row }) => (
        <span className="text-sm tabular-nums text-muted-foreground">
          {formatLocaleDate(row.original.createdAt, locale, {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        </span>
      ),
    },
    {
      id: "actions",
      header: t("contactMessages.table.actions"),
      cell: ({ row }) => {
        const msg = row.original
        return (
          <div className="flex gap-1">
            {msg.status === "NEW" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onUpdate(msg.id, "READ")}
              >
                {t("contactMessages.actions.markRead")}
              </Button>
            )}
            {msg.status !== "REPLIED" && msg.status !== "ARCHIVED" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onUpdate(msg.id, "REPLIED")}
              >
                {t("contactMessages.actions.markReplied")}
              </Button>
            )}
            {msg.status !== "ARCHIVED" && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onUpdate(msg.id, "ARCHIVED")}
              >
                {t("contactMessages.actions.archive")}
              </Button>
            )}
          </div>
        )
      },
    },
  ]
}
