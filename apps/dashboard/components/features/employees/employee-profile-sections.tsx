"use client"

/**
 * Employee Profile — Secondary sections
 * (Availability, Vacations, Services card wrapper)
 */

import { useRouter } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Calendar03Icon,
  Clock01Icon,
  Building04Icon,
  CheckmarkCircle02Icon,
  Cancel01Icon,
  PencilEdit01Icon,
} from "@hugeicons/core-free-icons"

import { Button, Card, CardAction, CardContent, CardHeader, CardTitle, Skeleton } from "@sawaa/ui"
import {
  useEmployeeAvailability,
  useEmployeeVacations,
} from "@/hooks/use-employees"
import { useLocale } from "@/components/locale-provider"
import { formatLocaleDate } from "@/lib/date"
import { DAY_NAME_KEYS } from "./create/schedule-types"
import { EmployeeServicesSection } from "./employee-services-section"

/* ─── Re-export Ratings so page imports from one place ─── */
export { EmployeeRatingsSection } from "./employee-ratings-section"

/* ─── Availability Section ─── */

interface WithId { employeeId: string }

export function EmployeeAvailabilitySection({ employeeId }: WithId) {
  const { t } = useLocale()
  const router = useRouter()
  const { data: schedule, isLoading } = useEmployeeAvailability(employeeId)

  const activeSlots = schedule?.filter((s) => s.isActive) ?? []
  const dayNames = DAY_NAME_KEYS.map((key) => t(key))

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary/10">
            <HugeiconsIcon icon={Clock01Icon} size={16} className="text-primary" />
          </div>
          {t("employees.detail.workingHours")}
        </CardTitle>
        <CardAction>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/employees/${employeeId}/edit`)}
          >
            <HugeiconsIcon icon={PencilEdit01Icon} size={14} />
            {t("employees.detail.editSchedule")}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={`skeleton-${i}`} className="h-8 rounded-md" />
            ))}
          </div>
        ) : activeSlots.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {t("employees.detail.noWorkingHours")}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {activeSlots.map((slot) => (
              <div
                key={slot.dayOfWeek}
                className="flex flex-col gap-1 rounded-md border border-border bg-surface-muted/40 p-2.5"
              >
                <span className="text-xs font-semibold text-foreground">
                  {dayNames[slot.dayOfWeek] ?? `Day ${slot.dayOfWeek}`}
                </span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {slot.startTime} – {slot.endTime}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/* ─── Vacations Section ─── */

export function EmployeeVacationsSection({ employeeId }: WithId) {
  const { t, locale } = useLocale()
  const { data: vacations, isLoading } = useEmployeeVacations(employeeId)

  const upcoming = (vacations ?? []).filter((v) => new Date(v.endDate) >= new Date())

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <div className="flex size-7 items-center justify-center rounded-md bg-warning/10">
            <HugeiconsIcon icon={Calendar03Icon} size={16} className="text-warning" />
          </div>
          {t("employees.detail.upcomingVacations")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={`skeleton-${i}`} className="h-12 rounded-md" />
            ))}
          </div>
        ) : upcoming.length === 0 ? (
          <div className="flex items-center gap-2 py-4">
            <HugeiconsIcon icon={CheckmarkCircle02Icon} size={16} className="text-success" />
            <p className="text-sm text-muted-foreground">
              {t("employees.detail.noVacations")}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {upcoming.map((v) => (
              <div
                key={v.id}
                className="flex items-center justify-between rounded-md border border-border bg-warning/5 p-3"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium tabular-nums text-foreground">
                    {formatLocaleDate(v.startDate, locale)}
                    {" – "}
                    {formatLocaleDate(v.endDate, locale)}
                  </span>
                  {v.reason && (
                    <span className="text-xs text-muted-foreground">{v.reason}</span>
                  )}
                </div>
                <HugeiconsIcon icon={Cancel01Icon} size={14} className="text-warning" />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/* ─── Services Card Wrapper ─── */

export function EmployeeServicesSectionCard({ employeeId }: WithId) {
  const { t } = useLocale()

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <div className="flex size-7 items-center justify-center rounded-md bg-accent/10">
            <HugeiconsIcon icon={Building04Icon} size={16} className="text-accent" />
          </div>
          {t("employees.detail.availableServices")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <EmployeeServicesSection employeeId={employeeId} />
      </CardContent>
    </Card>
  )
}
