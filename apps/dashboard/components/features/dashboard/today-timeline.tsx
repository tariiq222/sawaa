"use client"

import { useState } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { Card } from "@sawaa/ui"
import { Button } from "@sawaa/ui"
import { useLocale } from "@/components/locale-provider"
import { useBookingMutations } from "@/hooks/use-bookings"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Tick02Icon,
  Cancel01Icon,
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons"
import { formatName } from "@/lib/utils"
import type { Booking } from "@/lib/types/booking"

const VISIBLE_LIMIT = 6

interface TodayTimelineProps {
  bookings: Booking[]
  membershipRole?: string | null
}

const statusDot: Record<string, string> = {
  pending: "bg-warning",
  confirmed: "bg-primary",
  completed: "bg-success",
  cancelled: "bg-error",
}

export function TodayTimeline({ bookings, membershipRole }: TodayTimelineProps) {
  const { t } = useLocale()
  const { confirmMut, adminCancelMut } = useBookingMutations()
  const [loadingId, setLoadingId] = useState<string | null>(null)

  function handleConfirm(id: string) {
    setLoadingId(id)
    confirmMut.mutate(id, {
      onSettled: () => setLoadingId(null),
      onSuccess: () => toast.success(t("bookings.actions.toast.confirmed")),
      onError: () => toast.error(t("dashboard.timeline.error")),
    })
  }

  function handleCancel(id: string) {
    setLoadingId(id)
    adminCancelMut.mutate(
      { id, reason: "receptionist_cancel", refundType: "none" },
      {
        onSettled: () => setLoadingId(null),
        onSuccess: () => toast.success(t("bookings.actions.toast.cancelled")),
        onError: () => toast.error(t("dashboard.timeline.error")),
      },
    )
  }

  const visible = bookings.slice(0, VISIBLE_LIMIT)
  const remaining = bookings.length - VISIBLE_LIMIT

  return (
    <Card className="px-6 py-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">{t("dashboard.todaySchedule")}</h2>
        <Link
          href="/bookings"
          className="group inline-flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary/80"
        >
          {t("dashboard.viewAll")}
          <HugeiconsIcon
            icon={ArrowRight01Icon}
            size={12}
            className="rtl:rotate-180 motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5 motion-safe:rtl:group-hover:-translate-x-0.5"
          />
        </Link>
      </div>

      {bookings.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {t(
            membershipRole === "EMPLOYEE"
              ? "dashboard.timeline.empty.employee"
              : "dashboard.noAppointments",
          )}
        </p>
      ) : (
        <>
          <ul className="-mx-2 flex flex-col divide-y divide-border/70">
            {visible.map((b) => {
              const client = b.client ? formatName(b.client.firstName, b.client.lastName) : "—"
              const employee = b.employee?.user
                ? formatName(b.employee.user.firstName, b.employee.user.lastName, "")
                : ""
              const time = b.startTime?.slice(0, 5) ?? "—"
              const dot = statusDot[b.status] ?? "bg-muted-foreground"
              const isPending = b.status === "pending"

              return (
                <li
                  key={b.id}
                  className="group/row relative flex items-center gap-4 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/50"
                >
                  <div className="flex w-16 shrink-0 items-center gap-2">
                    <span className={cn("size-1.5 shrink-0 rounded-full", dot)} aria-hidden />
                    <span className="text-sm font-semibold tabular-nums text-foreground">
                      {time}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{client}</p>
                    {employee && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{employee}</p>
                    )}
                  </div>

                  {isPending && (
                    <div className="flex items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover/row:opacity-100 focus-within:opacity-100">
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        disabled={loadingId === b.id}
                        className="text-success hover:bg-success/10 hover:text-success"
                        title={t("dashboard.timeline.confirm")}
                        onClick={() => handleConfirm(b.id)}
                      >
                        <HugeiconsIcon icon={Tick02Icon} size={14} />
                      </Button>
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        disabled={loadingId === b.id}
                        className="text-muted-foreground hover:bg-error/10 hover:text-error"
                        title={t("dashboard.timeline.cancel")}
                        onClick={() => handleCancel(b.id)}
                      >
                        <HugeiconsIcon icon={Cancel01Icon} size={14} />
                      </Button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>

          {remaining > 0 && (
            <Link
              href="/bookings"
              className="mt-3 inline-flex w-full items-center justify-center gap-1 rounded-lg py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
            >
              {t("dashboard.moreAppointments").replace("{n}", String(remaining))}
            </Link>
          )}
        </>
      )}
    </Card>
  )
}
