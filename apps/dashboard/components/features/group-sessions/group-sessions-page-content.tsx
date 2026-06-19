"use client"

import { useState } from "react"
import { useLocale } from "@/components/locale-provider"
import { useGroupSessions } from "@/hooks/use-group-sessions"
import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { FilterBar } from "@/components/features/filter-bar"
import { DataTable } from "@/components/features/data-table"
import { ErrorBanner } from "@/components/features/error-banner"
import { Button, Skeleton, Switch, Label } from "@sawaa/ui"
import { CreateGroupSessionDialog } from "./create-group-session-dialog"
import { CancelGroupSessionDialog } from "./cancel-group-session-dialog"
import { getGroupSessionColumns } from "./group-session-columns"
import type { GroupSessionListItem, GroupSessionStatus } from "@/lib/types/group-session"

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

  const statusOptions = [
    { value: "all", label: t("groupSessions.filters.allStatuses") },
    { value: "OPEN", label: t("groupSessions.status.OPEN") },
    { value: "FULL", label: t("groupSessions.status.FULL") },
    { value: "CANCELLED", label: t("groupSessions.status.CANCELLED") },
    { value: "COMPLETED", label: t("groupSessions.status.COMPLETED") },
  ]

  const columns = getGroupSessionColumns({
    locale,
    t,
    onCancel: setCancelSession,
  })

  return (
    <ListPageShell>
      <Breadcrumbs />

      <PageHeader
        title={t("groupSessions.title")}
        description={t("groupSessions.description")}
      >
        <Button onClick={() => setCreateOpen(true)}>
          {t("groupSessions.newSession")}
        </Button>
      </PageHeader>

      <FilterBar
        selects={[
          {
            key: "status",
            value: filters.status,
            placeholder: t("groupSessions.filters.allStatuses"),
            options: statusOptions,
            onValueChange: (v) =>
              setFilters({ status: v as GroupSessionStatus | "all" }),
          },
        ]}
        trailing={
          <div className="flex items-center gap-2">
            <Switch
              id="gs-upcoming"
              checked={filters.upcoming}
              onCheckedChange={(v) => setFilters({ upcoming: v })}
            />
            <Label htmlFor="gs-upcoming" className="text-sm cursor-pointer">
              {t("groupSessions.filters.upcoming")}
            </Label>
          </div>
        }
        hasFilters={hasFilters}
        onReset={resetFilters}
      />

      {error && <ErrorBanner message={error} />}

      {loading && sessions.length === 0 ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={`row-${i}`} className="h-12 rounded-lg" />
          ))}
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={sessions}
          emptyTitle={t("groupSessions.empty.title")}
          emptyDescription={t("groupSessions.empty.description")}
          serverPaginated
          page={meta?.page}
          totalPages={meta?.totalPages}
          hasPreviousPage={meta ? meta.page > 1 : false}
          hasNextPage={meta ? meta.page < meta.totalPages : false}
          onPageChange={setPage}
        />
      )}

      <CreateGroupSessionDialog open={createOpen} onOpenChange={setCreateOpen} />

      {cancelSession && (
        <CancelGroupSessionDialog
          session={cancelSession}
          open={!!cancelSession}
          onOpenChange={(open) => {
            if (!open) setCancelSession(null)
          }}
        />
      )}
    </ListPageShell>
  )
}
