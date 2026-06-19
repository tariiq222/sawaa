"use client"

import { useQueryClient } from "@tanstack/react-query"
import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@sawaa/ui"
import { useLocale } from "@/components/locale-provider"
import { StatusBadge } from "@/components/features/status-badge"
import type { BookingStatus } from "@/lib/types/booking"
import { useBookingMutations } from "@/hooks/use-bookings"
import { queryKeys } from "@/lib/query-keys"
import type { GroupSessionEnrollment } from "@/lib/types/group-session"

interface EnrollmentsTableProps {
  enrollments: GroupSessionEnrollment[]
  sessionId: string
}

export function EnrollmentsTable({ enrollments, sessionId }: EnrollmentsTableProps) {
  const { t, locale } = useLocale()
  const queryClient = useQueryClient()
  const { confirmMut, completeMut, noShowMut, checkInMut, adminCancelMut } = useBookingMutations()

  const invalidateSession = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.groupSessions.detail(sessionId) })

  if (enrollments.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface-solid p-12 text-center">
        <p className="text-sm text-muted-foreground">{t("groupSessions.enrollments.empty")}</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-surface-solid overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("groupSessions.enrollments.col.client")}</TableHead>
            <TableHead>{t("groupSessions.enrollments.col.phone")}</TableHead>
            <TableHead>{t("groupSessions.enrollments.col.bookingStatus")}</TableHead>
            <TableHead>{t("groupSessions.enrollments.col.enrolledAt")}</TableHead>
            <TableHead>{t("groupSessions.enrollments.col.actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {enrollments.map((enrollment) => {
            const clientName =
              (enrollment.client?.name ??
              [enrollment.client?.firstName, enrollment.client?.lastName].filter(Boolean).join(" ")) ||
              t("groupSessions.enrollments.unknownClient")
            const phone = enrollment.client?.phone ?? "—"
            const booking = enrollment.booking
            const bookingId = booking?.id ?? enrollment.bookingId
            const status = booking?.status ?? ""
            const enrolledDate = new Date(enrollment.enrolledAt).toLocaleDateString(
              locale === "ar" ? "ar-SA" : "en-SA",
              { year: "numeric", month: "short", day: "numeric" }
            )

            const canCheckIn = status === "confirmed" && !booking?.checkedInAt
            const canNoShow = status === "confirmed"
            const canCancel = status !== "cancelled" && status !== "completed" && status !== "no_show"
            const canComplete = status === "confirmed" && !!booking?.checkedInAt
            const canConfirm =
              status === "pending" || status === "pending_group_fill" || status === "deposit_paid"

            return (
              <TableRow key={enrollment.bookingId}>
                <TableCell className="font-medium">{clientName}</TableCell>
                <TableCell className="tabular-nums text-sm text-muted-foreground">{phone}</TableCell>
                <TableCell>
                  {status ? (
                    <StatusBadge status={status as BookingStatus} />
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="tabular-nums text-sm text-muted-foreground">
                  {enrolledDate}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 flex-wrap">
                    {canCheckIn && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={checkInMut.isPending}
                        onClick={() => checkInMut.mutate(bookingId, { onSuccess: invalidateSession })}
                      >
                        {checkInMut.isPending
                          ? t("groupSessions.enrollments.actions.checkingIn")
                          : t("groupSessions.enrollments.actions.checkIn")}
                      </Button>
                    )}
                    {canConfirm && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={confirmMut.isPending}
                        onClick={() => confirmMut.mutate(bookingId, { onSuccess: invalidateSession })}
                      >
                        {confirmMut.isPending
                          ? t("groupSessions.enrollments.actions.confirming")
                          : t("groupSessions.enrollments.actions.confirm")}
                      </Button>
                    )}
                    {canComplete && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={completeMut.isPending}
                        onClick={() => completeMut.mutate(bookingId, { onSuccess: invalidateSession })}
                      >
                        {completeMut.isPending
                          ? t("groupSessions.enrollments.actions.completing")
                          : t("groupSessions.enrollments.actions.complete")}
                      </Button>
                    )}
                    {canNoShow && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-warning hover:text-warning"
                        disabled={noShowMut.isPending}
                        onClick={() => noShowMut.mutate(bookingId, { onSuccess: invalidateSession })}
                      >
                        {noShowMut.isPending
                          ? t("groupSessions.enrollments.actions.noShowing")
                          : t("groupSessions.enrollments.actions.noShow")}
                      </Button>
                    )}
                    {canCancel && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        disabled={adminCancelMut.isPending}
                        onClick={() =>
                          adminCancelMut.mutate(
                            { id: bookingId, reason: "OTHER" },
                            { onSuccess: invalidateSession }
                          )
                        }
                      >
                        {adminCancelMut.isPending
                          ? t("groupSessions.enrollments.actions.cancelling")
                          : t("groupSessions.enrollments.actions.cancel")}
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
