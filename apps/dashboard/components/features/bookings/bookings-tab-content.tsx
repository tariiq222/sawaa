"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Skeleton } from "@sawaa/ui"
import { Button } from "@sawaa/ui"
import { DataTable } from "@/components/features/data-table"
import { FilterBar } from "@/components/features/filter-bar"
import { ErrorBanner } from "@/components/features/error-banner"
import { getBookingColumns } from "@/components/features/bookings/booking-columns"
import { AdminCancelDialog } from "@/components/features/bookings/cancel-dialogs"
import { DeleteBookingDialog } from "@/components/features/bookings/delete-booking-dialog"
import { useBookings, useBookingMutations } from "@/hooks/use-bookings"
import { useEmployees } from "@/hooks/use-employees"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { useLocale } from "@/components/locale-provider"
import { useOrganizationConfig } from "@/hooks/use-organization-config"
import { ApiError } from "@/lib/api"
import type { Booking, CancellationReason } from "@/lib/types/booking"

interface BookingsTabContentProps {
  onRowClick: (b: Booking) => void
  onEditClick: (b: Booking) => void
}

export function BookingsTabContent({ onRowClick, onEditClick }: BookingsTabContentProps) {
  const { t, locale } = useLocale()
  const { weekStartDayNumber, dateFormat } = useOrganizationConfig()
  const queryClient = useQueryClient()
  const { bookings, meta, loading, error, filters, setFilters, resetFilters, hasFilters, setPage } = useBookings()
  const { confirmMut, noShowMut, adminCancelMut, deleteMut } = useBookingMutations()
  const { employees } = useEmployees()
  const [activeTimeTab, setActiveTimeTab] = useState("all")
  const [search, setSearch] = useState("")

  // Debounce search → filters.search (300ms)
  useEffect(() => {
    const id = window.setTimeout(() => {
      if (search !== filters.search) setFilters({ search })
    }, 300)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const [deleteTarget, setDeleteTarget] = useState<Booking | null>(null)
  const [deleteReason, setDeleteReason] = useState<CancellationReason | "">("")
  const [deleteAdminNotes, setDeleteAdminNotes] = useState("")
  const [hardDeleteTarget, setHardDeleteTarget] = useState<Booking | null>(null)

  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.bookings.all })

  const resetDelete = () => {
    setDeleteTarget(null)
    setDeleteReason("")
    setDeleteAdminNotes("")
  }

  const handleTimeTabChange = (key: string) => {
    setActiveTimeTab(key)
    const today = new Date()
    const fmt = (d: Date) => d.toISOString().split("T")[0]
    if (key === "all") {
      setFilters({ dateFrom: "", dateTo: "" })
    } else if (key === "today") {
      setFilters({ dateFrom: fmt(today), dateTo: fmt(today) })
    } else if (key === "week") {
      const start = new Date(today)
      start.setDate(today.getDate() - ((today.getDay() - weekStartDayNumber + 7) % 7))
      const end = new Date(start)
      end.setDate(start.getDate() + 6)
      setFilters({ dateFrom: fmt(start), dateTo: fmt(end) })
    } else if (key === "month") {
      const start = new Date(today.getFullYear(), today.getMonth(), 1)
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0)
      setFilters({ dateFrom: fmt(start), dateTo: fmt(end) })
    }
  }

  const handleStatusAction = async (booking: Booking, action: "confirm" | "noshow") => {
    try {
      if (action === "confirm") await confirmMut.mutateAsync(booking.id)
      else await noShowMut.mutateAsync(booking.id)
      refresh()
    } catch (err) {
      if (err instanceof ApiError && err.status >= 500) {
        const requestId = (err.body as Record<string, unknown> | undefined)?.requestId as string | undefined
        const base = t("bookings.actions.toast.serverError")
        toast.error(requestId ? `${base} (رقم الطلب: ${requestId})` : base)
      } else {
        toast.error(err instanceof Error ? err.message : t("bookings.actions.toast.genericError"))
      }
    }
  }

  // Terminal bookings can't be cancelled, so the trash action hard-deletes
  // them; active bookings open the cancel dialog (refund/notify flow).
  const TERMINAL_STATUSES = new Set(["completed", "cancelled", "no_show", "expired"])

  const handleDelete = (booking: Booking) => {
    if (TERMINAL_STATUSES.has(booking.status)) setHardDeleteTarget(booking)
    else setDeleteTarget(booking)
  }

  const handleHardDelete = async () => {
    if (!hardDeleteTarget) return
    try {
      await deleteMut.mutateAsync(hardDeleteTarget.id)
      setHardDeleteTarget(null)
      refresh()
    } catch (err) {
      if (err instanceof ApiError && err.status >= 500) {
        const requestId = (err.body as Record<string, unknown> | undefined)?.requestId as string | undefined
        const base = t("bookings.actions.toast.serverError")
        toast.error(requestId ? `${base} (رقم الطلب: ${requestId})` : base)
      } else {
        toast.error(err instanceof Error ? err.message : t("bookings.actions.toast.genericError"))
      }
    }
  }

  const columns = useMemo(
    () => getBookingColumns(onRowClick, onEditClick, handleStatusAction, handleDelete, t, { dateFormat, locale }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, dateFormat, locale]
  )

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
      <FilterBar
        search={{ value: search, onChange: setSearch, placeholder: t("bookings.searchPlaceholder") }}
        tabs={{
          items: [
            { key: "all", label: t("bookings.filters.allTime") },
            { key: "today", label: t("bookings.filters.today") },
            { key: "week", label: t("bookings.filters.thisWeek") },
            { key: "month", label: t("bookings.filters.thisMonth") },
          ],
          activeKey: activeTimeTab,
          onTabChange: handleTimeTabChange,
        }}
        selects={[
          {
            key: "type",
            value: filters.type,
            placeholder: t("bookings.filters.type"),
            options: [
              { value: "all", label: t("bookings.filters.allTypes") },
              { value: "in_person", label: t("bookings.filters.inPerson") },
              { value: "online", label: t("bookings.filters.online") },
              { value: "group", label: t("bookings.filters.group") },
              { value: "walk_in", label: t("bookings.filters.walkIn") },
            ],
            onValueChange: (v) => setFilters({ type: v as typeof filters.type }),
          },
          {
            key: "isGuest",
            value: String(filters.isGuest),
            placeholder: t("bookings.filters.source"),
            options: [
              { value: "all", label: t("bookings.filters.allSources") },
              { value: "true", label: t("bookings.filters.sourceOnline") },
              { value: "false", label: t("bookings.filters.sourceOther") },
            ],
            onValueChange: (v) =>
              setFilters({ isGuest: v === "all" ? "all" : v === "true" }),
          },
          {
            key: "employeeId",
            value: filters.employeeId || "all",
            placeholder: t("bookings.filters.employee"),
            options: [
              { value: "all", label: t("bookings.filters.allEmployees") },
              ...employees.map((p) => ({
                value: p.id,
                label: `${p.user.firstName} ${p.user.lastName}`,
              })),
            ],
            onValueChange: (v) => setFilters({ employeeId: v === "all" ? "" : v }),
          },
          {
            key: "status",
            value: filters.status,
            placeholder: t("bookings.filters.status"),
            options: [
              { value: "all", label: t("bookings.filters.allStatuses") },
              { value: "pending", label: t("bookings.filters.pending") },
              { value: "confirmed", label: t("bookings.filters.confirmed") },
              { value: "completed", label: t("bookings.filters.completed") },
              { value: "cancelled", label: t("bookings.filters.cancelled") },
              { value: "cancel_requested", label: t("bookings.filters.cancelRequested") },
              { value: "no_show", label: t("bookings.filters.noShow") },
              { value: "expired", label: t("bookings.filters.expired") },
            ],
            onValueChange: (v) => setFilters({ status: v as typeof filters.status }),
          },
        ]}
        dateRange={{
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo,
          onDateFromChange: (v) => setFilters({ dateFrom: v }),
          onDateToChange: (v) => setFilters({ dateTo: v }),
          placeholderFrom: t("bookings.filters.from"),
          placeholderTo: t("bookings.filters.to"),
        }}
        hasFilters={hasFilters}
        onReset={() => { setSearch(""); resetFilters(); setActiveTimeTab("all") }}
      />

      {error && <ErrorBanner message={error} onRetry={refresh} retryLabel={t("bookings.filters.reset")} />}

      {loading && (!bookings || bookings.length === 0) ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={`skeleton-${i}`} className="h-12 rounded-lg" />
          ))}
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={bookings}
          emptyTitle={t("bookings.empty.title")}
          emptyDescription={t("bookings.empty.description")}
          serverPaginated
        />
      )}
      </div>

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{t("bookings.pagination.page")} {meta.page} {t("bookings.pagination.of")} {meta.totalPages}</span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!meta.hasPreviousPage}
              onClick={() => setPage(meta.page - 1)}
            >
              {t("bookings.pagination.previous")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!meta.hasNextPage}
              onClick={() => setPage(meta.page + 1)}
            >
              {t("bookings.pagination.next")}
            </Button>
          </div>
        </div>
      )}

      <AdminCancelDialog
        open={deleteTarget !== null}
        cancelReason={deleteReason as CancellationReason | ""}
        setCancelReason={setDeleteReason}
        adminNotes={deleteAdminNotes}
        setAdminNotes={setDeleteAdminNotes}
        loading={adminCancelMut.isPending}
        onReset={resetDelete}
        onCancel={async () => {
          if (!deleteTarget) return
          if (!deleteReason) return
          try {
            await adminCancelMut.mutateAsync({
              id: deleteTarget.id,
              reason: deleteReason as CancellationReason,
              cancelNotes: deleteAdminNotes || undefined,
            })
            refresh()
            resetDelete()
          } catch (err) {
            if (err instanceof ApiError && err.status >= 500) {
              const requestId = (err.body as Record<string, unknown> | undefined)?.requestId as string | undefined
              const base = t("bookings.actions.toast.serverError")
              toast.error(requestId ? `${base} (رقم الطلب: ${requestId})` : base)
            } else {
              toast.error(err instanceof Error ? err.message : t("bookings.actions.toast.genericError"))
            }
          }
        }}
      />

      <DeleteBookingDialog
        open={hardDeleteTarget !== null}
        loading={deleteMut.isPending}
        onClose={() => setHardDeleteTarget(null)}
        onConfirm={handleHardDelete}
      />
    </div>
  )
}
