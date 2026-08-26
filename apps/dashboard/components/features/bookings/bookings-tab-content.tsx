// EXCEPTION: 315 lines — mutation handlers (handleStatusAction, handleDelete, handleHardDelete) share local dialog state and cannot be split without a dedicated hook. Approved 2026-06-19; size +9 added 2026-08-26 for clinic-local tab date helpers (todayClinicYmd / clinicWeekRange / clinicMonthRange).
"use client"

import { useEffect, useMemo, useState } from "react"
import { Button, Skeleton } from "@sawaa/ui"
import { HugeiconsIcon } from "@hugeicons/react"
import { Download01Icon } from "@hugeicons/core-free-icons"
import { toast } from "sonner"
import { DataTable } from "@/components/features/data-table"
import { FilterBar } from "@/components/features/filter-bar"
import { ErrorBanner } from "@/components/features/error-banner"
import { getBookingColumns } from "@/components/features/bookings/booking-columns"
import type { QuickStatusActionType } from "@/components/features/bookings/booking-column-cells"
import { AdminCancelDialog } from "@/components/features/bookings/cancel-dialogs"
import { DeleteBookingDialog } from "@/components/features/bookings/delete-booking-dialog"
import { useBookings, useBookingMutations } from "@/hooks/use-bookings"
import { useEmployees } from "@/hooks/use-employees"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { useLocale } from "@/components/locale-provider"
import { useOrganizationConfig } from "@/hooks/use-organization-config"
import { showApiError } from "@/lib/mutation-helpers"
import { useBookingsExport } from "@/hooks/use-bookings-export"
import { clinicMonthRange, clinicWeekRange, todayClinicYmd } from "@/lib/utils"
import type { Booking, CancellationReason } from "@/lib/types/booking"

interface BookingsTabContentProps {
  onRowClick: (b: Booking, tab?: "details" | "reschedule" | "invoice") => void
}

export function BookingsTabContent({ onRowClick }: BookingsTabContentProps) {
  const { t, locale } = useLocale()
  const { weekStartDayNumber, dateFormat } = useOrganizationConfig()
  const queryClient = useQueryClient()
  const { bookings, meta, loading, error, filters, setFilters, resetFilters, hasFilters, setPage, query } = useBookings()
  const { confirmMut, checkInMut, completeMut, noShowMut, adminCancelMut, deleteMut } = useBookingMutations()
  const { employees } = useEmployees()
  const [activeTimeTab, setActiveTimeTab] = useState("today")
  const [search, setSearch] = useState("")
  const bookingsExport = useBookingsExport()

  const handleExport = async () => {
    try {
      const result = await bookingsExport.mutateAsync({ ...query, search: search || undefined })
      toast.success(t("bookings.export.success").replace("{count}", String(result.rowCount)))
    } catch (err) {
      showApiError(err, { fallback: t("bookings.export.error"), t })
    }
  }

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
    if (key === "all") {
      // Clearing dates is a deliberate "all-time" view — break out of the
      // today-baseline so `hasFilters` flips true and Reset is offered.
      setFilters({ dateFrom: "", dateTo: "" })
    } else if (key === "today") {
      const today = todayClinicYmd()
      setFilters({ dateFrom: today, dateTo: today })
    } else if (key === "week") {
      const range = clinicWeekRange(weekStartDayNumber)
      setFilters({ dateFrom: range.dateFrom, dateTo: range.dateTo })
    } else if (key === "month") {
      const range = clinicMonthRange()
      setFilters({ dateFrom: range.dateFrom, dateTo: range.dateTo })
    }
  }

  const handleStatusAction = async (booking: Booking, action: QuickStatusActionType) => {
    if (booking.isHistoricalImport) return
    if (action === "reschedule") { onRowClick(booking, "reschedule"); return }
    try {
      if (action === "confirm") await confirmMut.mutateAsync(booking.id)
      else if (action === "checkin") await checkInMut.mutateAsync(booking.id)
      else if (action === "complete") await completeMut.mutateAsync(booking.id)
      else await noShowMut.mutateAsync(booking.id)
      refresh()
    } catch (err) {
      showApiError(err, { fallback: t("bookings.actions.toast.genericError"), t })
    }
  }

  // Terminal bookings can't be cancelled, so the trash action hard-deletes
  // them; active bookings open the cancel dialog (refund/notify flow).
  const TERMINAL_STATUSES = new Set(["completed", "cancelled", "no_show", "expired"])

  const handleDelete = (booking: Booking) => {
    if (booking.isHistoricalImport) return
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
      showApiError(err, { fallback: t("bookings.actions.toast.genericError"), t })
    }
  }

  const columns = useMemo(
    () => getBookingColumns(onRowClick, handleStatusAction, handleDelete, t, { dateFormat, locale }),
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
            key: "delivery",
            value: filters.delivery,
            placeholder: t("bookings.filters.delivery"),
            options: [
              { value: "all", label: t("bookings.filters.allDelivery") },
              { value: "IN_PERSON", label: t("bookings.filters.inPerson") },
              { value: "ONLINE", label: t("bookings.filters.online") },
            ],
            onValueChange: (v) => setFilters({ delivery: v as typeof filters.delivery }),
          },
          {
            key: "type",
            value: filters.type,
            placeholder: t("bookings.filters.type"),
            options: [
              { value: "all", label: t("bookings.filters.allTypes") },
              { value: "individual", label: t("bookings.filters.individual") },
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
        onReset={() => { setSearch(""); resetFilters(); setActiveTimeTab("today") }}
        trailing={
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={bookingsExport.isPending}
            onClick={() => void handleExport()}
          >
            <HugeiconsIcon icon={Download01Icon} size={16} />
            {bookingsExport.isPending ? t("bookings.export.exporting") : t("bookings.export.csv")}
          </Button>
        }
      />

      {error && (!bookings || bookings.length === 0) && (
        <ErrorBanner message={error} onRetry={refresh} retryLabel={t("bookings.filters.reset")} />
      )}

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
            showApiError(err, { fallback: t("bookings.actions.toast.genericError"), t })
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
