"use client"

import type { ColumnDef } from "@tanstack/react-table"
import Link from "next/link"
import { Badge, Button } from "@sawaa/ui"
import { HugeiconsIcon } from "@hugeicons/react"
import { Cancel01Icon } from "@hugeicons/core-free-icons"
import { formatRef } from "@/lib/utils"
import type { GroupSessionListItem } from "@/lib/types/group-session"
import { groupSessionStatusVariant } from "./group-session-status"

function formatDateTime(iso: string, locale: string): string {
  return new Date(iso).toLocaleString(locale === "ar" ? "ar-SA" : "en-SA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatPrice(halalas: number): string {
  return (halalas / 100).toLocaleString("en-SA", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

interface GetGroupSessionColumnsOptions {
  locale: string
  t: (key: string) => string
  onCancel: (session: GroupSessionListItem) => void
}

export function getGroupSessionColumns({
  locale,
  t,
  onCancel,
}: GetGroupSessionColumnsOptions): ColumnDef<GroupSessionListItem>[] {
  return [
    {
      accessorKey: "title",
      header: t("groupSessions.col.title"),
      cell: ({ row }) => {
        const session = row.original
        return (
          <Link
            href={`/group-sessions/${formatRef("GS", session.ref)}`}
            className="font-medium hover:text-primary transition-colors"
          >
            {session.title}
            {session.isPublic && (
              <span className="ms-2 text-xs text-muted-foreground">
                ({t("groupSessions.badge.public")})
              </span>
            )}
          </Link>
        )
      },
    },
    {
      accessorKey: "scheduledAt",
      header: t("groupSessions.col.scheduledAt"),
      cell: ({ row }) => (
        <span className="tabular-nums text-sm">
          {formatDateTime(row.original.scheduledAt, locale)}
        </span>
      ),
    },
    {
      accessorKey: "durationMins",
      header: t("groupSessions.col.duration"),
      cell: ({ row }) => (
        <span className="tabular-nums text-sm">
          {row.original.durationMins} {t("common.min")}
        </span>
      ),
    },
    {
      id: "capacity",
      header: t("groupSessions.col.capacity"),
      cell: ({ row }) => {
        const s = row.original
        return (
          <span className="tabular-nums text-sm">
            {s.enrolledCount}/{s.maxCapacity}{" "}
            <span className="text-muted-foreground">
              ({s.spotsLeft} {t("groupSessions.col.spotsLeft")})
            </span>
          </span>
        )
      },
    },
    {
      accessorKey: "price",
      header: t("groupSessions.col.price"),
      cell: ({ row }) => (
        <span className="tabular-nums text-sm">
          {formatPrice(row.original.price)} {t("groupSessions.currency")}
        </span>
      ),
    },
    {
      accessorKey: "deliveryType",
      header: t("groupSessions.col.deliveryType"),
      cell: ({ row }) => (
        <Badge variant="outline" className="text-xs">
          {row.original.deliveryType === "IN_PERSON"
            ? t("groupSessions.deliveryType.inPerson")
            : t("groupSessions.deliveryType.online")}
        </Badge>
      ),
    },
    {
      accessorKey: "status",
      header: t("groupSessions.col.status"),
      cell: ({ row }) => (
        <Badge variant={groupSessionStatusVariant(row.original.status)}>
          {t(`groupSessions.status.${row.original.status}`)}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: t("groupSessions.col.actions"),
      cell: ({ row }) => {
        const session = row.original
        if (session.status !== "OPEN") return null
        return (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => onCancel(session)}
          >
            <HugeiconsIcon icon={Cancel01Icon} size={14} />
            {t("groupSessions.action.cancel")}
          </Button>
        )
      },
    },
  ]
}
