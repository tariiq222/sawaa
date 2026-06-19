"use client"

import { useState } from "react"
import Link from "next/link"
import { useLocale } from "@/components/locale-provider"
import { useGroupSessions } from "@/hooks/use-group-sessions"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Badge,
  Switch,
  Label,
} from "@sawaa/ui"
import { CreateGroupSessionDialog } from "./create-group-session-dialog"
import { CancelGroupSessionDialog } from "./cancel-group-session-dialog"
import type { GroupSessionListItem, GroupSessionStatus } from "@/lib/types/group-session"

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

type StatusVariant = "default" | "secondary" | "destructive" | "outline"

function statusBadgeVariant(status: GroupSessionStatus): StatusVariant {
  switch (status) {
    case "OPEN": return "default"
    case "FULL": return "secondary"
    case "CANCELLED": return "destructive"
    case "COMPLETED": return "outline"
  }
}

export function GroupSessionsPageContent() {
  const { t, locale } = useLocale()
  const {
    sessions,
    meta,
    loading,
    error,
    filters,
    setFilters,
    resetFilters,
    setPage,
    hasFilters,
  } = useGroupSessions()

  const [createOpen, setCreateOpen] = useState(false)
  const [cancelSession, setCancelSession] = useState<GroupSessionListItem | null>(null)

  const statuses: Array<{ value: GroupSessionStatus | "all"; label: string }> = [
    { value: "all", label: t("groupSessions.filters.allStatuses") },
    { value: "OPEN", label: t("groupSessions.status.OPEN") },
    { value: "FULL", label: t("groupSessions.status.FULL") },
    { value: "CANCELLED", label: t("groupSessions.status.CANCELLED") },
    { value: "COMPLETED", label: t("groupSessions.status.COMPLETED") },
  ]

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t("groupSessions.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("groupSessions.description")}</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          {t("groupSessions.newSession")}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <Select
          value={filters.status}
          onValueChange={(v) => setFilters({ status: v as GroupSessionStatus | "all" })}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statuses.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Switch
            id="upcoming-toggle"
            checked={filters.upcoming}
            onCheckedChange={(v) => setFilters({ upcoming: v })}
          />
          <Label htmlFor="upcoming-toggle" className="text-sm cursor-pointer">
            {t("groupSessions.filters.upcoming")}
          </Label>
        </div>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            {t("groupSessions.filters.reset")}
          </Button>
        )}
      </div>

      {/* Table */}
      {error ? (
        <p className="text-destructive text-sm">{t("common.errorLoading")}</p>
      ) : loading ? (
        <p className="text-muted-foreground text-sm">{t("common.loading")}</p>
      ) : sessions.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-solid p-12 text-center">
          <p className="font-medium text-foreground">{t("groupSessions.empty.title")}</p>
          <p className="text-sm text-muted-foreground mt-1">{t("groupSessions.empty.description")}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface-solid overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("groupSessions.col.title")}</TableHead>
                <TableHead>{t("groupSessions.col.scheduledAt")}</TableHead>
                <TableHead>{t("groupSessions.col.duration")}</TableHead>
                <TableHead>{t("groupSessions.col.capacity")}</TableHead>
                <TableHead>{t("groupSessions.col.price")}</TableHead>
                <TableHead>{t("groupSessions.col.deliveryType")}</TableHead>
                <TableHead>{t("groupSessions.col.status")}</TableHead>
                <TableHead>{t("groupSessions.col.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((session) => (
                <TableRow key={session.id}>
                  <TableCell className="font-medium">
                    <Link href={`/group-sessions/${session.id}`} className="hover:text-primary transition-colors">
                      {session.title}
                      {session.isPublic && (
                        <span className="ms-2 text-xs text-muted-foreground">
                          ({t("groupSessions.badge.public")})
                        </span>
                      )}
                    </Link>
                  </TableCell>
                  <TableCell className="tabular-nums text-sm">
                    {formatDateTime(session.scheduledAt, locale)}
                  </TableCell>
                  <TableCell className="tabular-nums text-sm">
                    {session.durationMins} {t("common.min")}
                  </TableCell>
                  <TableCell className="tabular-nums text-sm">
                    {session.enrolledCount}/{session.maxCapacity}
                    {" "}
                    <span className="text-muted-foreground">
                      ({session.spotsLeft} {t("groupSessions.col.spotsLeft")})
                    </span>
                  </TableCell>
                  <TableCell className="tabular-nums text-sm">
                    {formatPrice(session.price)} {t("groupSessions.currency")}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {session.deliveryType === "IN_PERSON"
                        ? t("groupSessions.deliveryType.inPerson")
                        : t("groupSessions.deliveryType.online")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant(session.status)}>
                      {t(`groupSessions.status.${session.status}`)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {session.status === "OPEN" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setCancelSession(session)}
                      >
                        {t("groupSessions.action.cancel")}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination — use meta.page (NOT meta.currentPage) */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {t("table.pagination.page")} {meta.page} {t("table.pagination.of")} {meta.totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={meta.page <= 1}
              onClick={() => setPage(meta.page - 1)}
            >
              {t("table.pagination.previous")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={meta.page >= meta.totalPages}
              onClick={() => setPage(meta.page + 1)}
            >
              {t("table.pagination.next")}
            </Button>
          </div>
        </div>
      )}

      {/* Dialogs */}
      <CreateGroupSessionDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
      {cancelSession && (
        <CancelGroupSessionDialog
          session={cancelSession}
          open={!!cancelSession}
          onOpenChange={(open) => { if (!open) setCancelSession(null) }}
        />
      )}
    </div>
  )
}
