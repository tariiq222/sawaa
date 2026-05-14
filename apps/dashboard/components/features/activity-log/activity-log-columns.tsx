"use client"

import { ar } from "date-fns/locale"
import type { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@deqah/ui"
import { Avatar, AvatarFallback } from "@deqah/ui"
import { getInitials } from "@/lib/utils"
import { formatDatePattern } from "@/lib/date"
import type { ActivityLog } from "@/lib/types/activity-log"

const actionStyles: Record<string, string> = {
  created: "border-success/30 bg-success/10 text-success",
  CREATE: "border-success/30 bg-success/10 text-success",
  updated: "border-info/30 bg-info/10 text-info",
  UPDATE: "border-info/30 bg-info/10 text-info",
  deleted: "border-destructive/30 bg-destructive/10 text-destructive",
  DELETE: "border-destructive/30 bg-destructive/10 text-destructive",
  login: "border-primary/30 bg-primary/10 text-primary",
  logout: "border-muted-foreground/30 bg-muted text-muted-foreground",
  approved: "border-success/30 bg-success/10 text-success",
  rejected: "border-destructive/30 bg-destructive/10 text-destructive",
  SYSTEM: "border-muted-foreground/30 bg-muted text-muted-foreground",
}

function humanizeModule(raw: string | null | undefined): string {
  if (!raw || raw === "Unknown") return "—"
  // Convert PascalCase or kebab to Title Case spaced
  const spaced = raw
    .replace(/[-_]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

function humanizeDescription(raw: string | null | undefined): string {
  if (!raw) return "—"
  // Migrate legacy "POST Unknown" / "PATCH Unknown" rows produced before the
  // audit interceptor fix: drop the bare verb-noun-Unknown shape.
  if (/^(POST|PATCH|PUT|DELETE)\s+Unknown\b/i.test(raw)) return "—"
  return raw
}

export function getActivityLogColumns(
  t: (key: string) => string,
  locale: "en" | "ar" = "en",
): ColumnDef<ActivityLog>[] {
  return [
    {
      id: "user",
      header: t("activityLog.col.user"),
      cell: ({ row }) => {
        const u = row.original.user
        const fallbackEmail = row.original.userEmail
        if (!u && !fallbackEmail) {
          return (
            <span className="text-sm text-muted-foreground">
              {t("activityLog.system")}
            </span>
          )
        }
        const fullName = u
          ? `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim()
          : ""
        const display = fullName || u?.email || fallbackEmail || ""
        const initials = u
          ? getInitials(u.firstName, u.lastName)
          : (fallbackEmail?.[0] ?? "?").toUpperCase()
        return (
          <div className="flex items-center gap-2">
            <Avatar className="size-6">
              <AvatarFallback className="bg-primary/10 text-[9px] font-semibold text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm text-foreground">{display}</span>
          </div>
        )
      },
    },
    {
      accessorKey: "action",
      header: t("activityLog.col.action"),
      cell: ({ row }) => (
        <Badge
          variant="outline"
          className={actionStyles[row.original.action] ?? ""}
        >
          {row.original.action}
        </Badge>
      ),
    },
    {
      accessorKey: "module",
      header: t("activityLog.col.module"),
      cell: ({ row }) => {
        const label = humanizeModule(row.original.module)
        if (label === "—") {
          return <span className="text-sm text-muted-foreground">—</span>
        }
        return (
          <Badge variant="secondary" className="text-[10px]">
            {label}
          </Badge>
        )
      },
    },
    {
      accessorKey: "description",
      header: t("activityLog.col.description"),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground line-clamp-1 max-w-[300px]">
          {humanizeDescription(row.original.description)}
        </span>
      ),
    },
    {
      accessorKey: "resourceId",
      header: t("activityLog.col.resource"),
      cell: ({ row }) => (
        <span className="tabular-nums text-sm text-muted-foreground">
          {row.original.resourceId?.slice(0, 8) ?? "—"}
        </span>
      ),
    },
    {
      accessorKey: "createdAt",
      header: t("activityLog.col.time"),
      cell: ({ row }) => (
        <span className="tabular-nums text-sm text-muted-foreground">
          {formatDatePattern(row.original.createdAt, "MMM d, yyyy HH:mm", {
            locale: locale === "ar" ? ar : undefined,
          })}
        </span>
      ),
    },
  ]
}
