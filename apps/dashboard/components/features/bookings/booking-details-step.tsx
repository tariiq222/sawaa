"use client"

import React from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  UserCircleIcon,
  Store01Icon,
  Stethoscope02Icon,
  Calendar03Icon,
  Clock01Icon,
} from "@hugeicons/core-free-icons"

import { Button } from "@deqah/ui"
import { Label } from "@deqah/ui"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deqah/ui"
import { DatePicker } from "@/components/ui/date-picker"

import { useEmployees } from "@/hooks/use-employees"
import { useCreateBookingSlots } from "@/components/features/bookings/use-booking-slots"
import { useBookingCreateResets } from "@/components/features/bookings/use-booking-form-resets"
import { BookingEmployeeSection } from "@/components/features/bookings/booking-employee-section"
import { useProgressiveDisclosure } from "@/components/features/bookings/use-progressive-disclosure"
import { ProgressiveField } from "@/components/features/bookings/progressive-field"
import { useLocale } from "@/components/locale-provider"
import { cn } from "@/lib/utils"
import {
  bookingCreateSchema,
  type BookingCreateFormData,
} from "@/lib/schemas/booking.schema"

export type BookingFormData = BookingCreateFormData

/* ── Card & section style helpers ── */

const card = "bg-surface rounded-xl border border-border shadow-sm overflow-hidden"
const sectionDivider = "border-t border-border"
const sectionHeader = "px-4 py-2.5 flex items-center gap-2"
const sectionTitle = "text-xs font-semibold text-muted-foreground uppercase tracking-wider"
const sectionBody = "px-4 py-4 flex flex-col gap-3"

/* ── FormField wrapper ── */

function FormField({
  label,
  error,
  children,
  icon,
  className,
}: {
  label: string
  error?: string
  children: React.ReactNode
  icon?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

/* ── Step 2: Booking details ── */

interface BookingStepProps {
  clientName: string
  onSubmit: (data: BookingFormData) => Promise<void>
  submitting: boolean
}

export function BookingStep({ clientName, onSubmit: onSubmitProp, submitting }: BookingStepProps) {
  const { t } = useLocale()
  const { employees, isLoading: employeesLoading } = useEmployees()

  const form = useForm<BookingCreateFormData>({
    resolver: zodResolver(bookingCreateSchema),
    defaultValues: {
      employeeId: "",
      serviceId: "",
      type: "in_person" as const,
      durationOptionId: "",
      date: "",
      startTime: "",
      payAtClinic: false,
    },
  })

  const [
    watchedEmployeeId,
    watchedServiceId,
    watchedType,
    watchedDurationOptionId,
    watchedDate,
    watchedStartTime,
  ] = form.watch(["employeeId", "serviceId", "type", "durationOptionId", "date", "startTime"])

  useBookingCreateResets(form, watchedEmployeeId, watchedServiceId, watchedType, watchedDate)

  const { employeeServices, employeeServicesLoading, durationOptions, hasDurationOptions, canFetchSlots, serviceTypesLoading, canFetchServiceTypes, slots, slotsLoading } =
    useCreateBookingSlots({
      employeeId: watchedEmployeeId,
      serviceId: watchedServiceId,
      bookingType: watchedType,
      date: watchedDate,
      durationOptionId: watchedDurationOptionId ?? "",
    })

  const availableTypes = React.useMemo(() => {
    if (!watchedServiceId || !employeeServices.length) return []
    const ps = employeeServices.find((s) => s.serviceId === watchedServiceId)
    return ps?.availableTypes ?? []
  }, [watchedServiceId, employeeServices])

  // Auto-select first available type, or clear if current type not in availableTypes
  React.useEffect(() => {
    if (!availableTypes.length) return
    if (!availableTypes.includes(watchedType)) {
      const firstValid = availableTypes[0] as BookingCreateFormData["type"]
      form.setValue("type", firstValid)
    }
  }, [availableTypes, watchedType, form])

  const visibility = useProgressiveDisclosure({
    employeeId: watchedEmployeeId,
    serviceId: watchedServiceId,
    type: watchedType,
    durationOptionId: watchedDurationOptionId ?? "",
    date: watchedDate,
    startTime: watchedStartTime,
    hasDurationOptions,
  })

  const slotPlaceholder = (() => {
    if (!watchedEmployeeId || !watchedDate) return t("bookings.form.slot.selectEmployeeAndDate")
    if (hasDurationOptions && !watchedDurationOptionId) return t("bookings.form.slot.selectDurationFirst")
    if (slotsLoading) return t("bookings.form.slot.loadingSlots")
    return t("bookings.form.placeholder.selectTime")
  })()

  return (
    <form id="booking-form" onSubmit={form.handleSubmit(onSubmitProp)} className="flex flex-col gap-3">

      {/* Selected client indicator */}
      <div className="flex items-center gap-2.5 rounded-xl border border-success/20 bg-success/10 px-4 py-2.5">
        <HugeiconsIcon icon={UserCircleIcon} size={16} className="shrink-0 text-success" />
        <span className="text-sm font-medium text-success">{clientName}</span>
      </div>

      {/* Unified card: all booking fields */}
      <div className={card}>

        {/* Section 1: Employee + Service + Type + Duration */}
        <div className={sectionHeader}>
          <HugeiconsIcon icon={Stethoscope02Icon} size={13} className="text-muted-foreground shrink-0" />
          <p className={sectionTitle}>{t("bookings.form.section.employeeService")}</p>
        </div>
        <BookingEmployeeSection
          form={form}
          employees={employees}
          employeeServices={employeeServices}
          employeesLoading={employeesLoading}
          employeeServicesLoading={employeeServicesLoading}
          availableTypes={availableTypes}
          canFetchServiceTypes={canFetchServiceTypes}
          serviceTypesLoading={serviceTypesLoading}
          hasDurationOptions={hasDurationOptions}
          durationOptions={durationOptions}
          visibility={visibility}
        />

        {/* Section 2: Date + Time */}
        <ProgressiveField show={visibility.showDatetime}>
          <div className={sectionDivider}>
            <div className={sectionHeader}>
              <HugeiconsIcon icon={Calendar03Icon} size={13} className="text-muted-foreground shrink-0" />
              <p className={sectionTitle}>{t("bookings.form.section.appointment")}</p>
            </div>
            <div className={cn(sectionBody, "grid grid-cols-2 gap-4")}>
              <FormField
                label={t("bookings.form.label.date")}
                icon={<HugeiconsIcon icon={Calendar03Icon} size={13} className="shrink-0" />}
                error={form.formState.errors.date?.message}
              >
                <Controller control={form.control} name="date" render={({ field }) => (
                  <DatePicker value={field.value} onChange={field.onChange} placeholder={t("bookings.form.placeholder.selectDate")} className="w-full bg-surface-muted" />
                )} />
              </FormField>

              <ProgressiveField show={visibility.showTime}>
                <FormField
                  label={t("bookings.form.label.time")}
                  icon={<HugeiconsIcon icon={Clock01Icon} size={13} className="shrink-0" />}
                  error={form.formState.errors.startTime?.message}
                >
                  <Controller control={form.control} name="startTime" render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange} disabled={!canFetchSlots}>
                      <SelectTrigger className="h-10 bg-surface-muted border-border"><SelectValue placeholder={slotPlaceholder} /></SelectTrigger>
                      <SelectContent>
                        {slots.length === 0 && !slotsLoading && (
                          <SelectItem value="__empty__" disabled>{t("bookings.form.placeholder.noSlots")}</SelectItem>
                        )}
                        {slots.map((slot) => (
                          <SelectItem key={slot.startTime} value={slot.startTime} className="font-numeric">
                            {slot.startTime} – {slot.endTime}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )} />
                </FormField>
              </ProgressiveField>
            </div>
          </div>
        </ProgressiveField>

        {/* Section 3: Payment method */}
        <ProgressiveField show={visibility.showPayAtClinic}>
          <Controller control={form.control} name="payAtClinic" render={({ field }) => (
            <div className={sectionDivider}>
              <button
                type="button"
                onClick={() => field.onChange(!field.value)}
                className={cn(
                  "flex items-center gap-3 w-full px-4 py-3 text-start transition-colors",
                  field.value ? "bg-primary/5" : "hover:bg-surface-muted"
                )}
              >
                <div className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                  field.value ? "bg-primary/10" : "bg-surface-muted"
                )}>
                  <HugeiconsIcon
                    icon={Store01Icon}
                    size={16}
                    className={field.value ? "text-primary" : "text-muted-foreground"}
                  />
                </div>
                <div className="flex-1">
                  <p className={cn("text-sm font-medium", field.value ? "text-primary" : "text-foreground")}>
                    {t("bookings.form.payAtClinic.title")}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t("bookings.form.payAtClinic.description")}
                  </p>
                </div>
                <div className={cn(
                  "size-4 rounded-full border-2 shrink-0 transition-colors",
                  field.value ? "border-primary bg-primary" : "border-muted-foreground"
                )} />
              </button>
            </div>
          )} />
        </ProgressiveField>

      </div>

      <Button type="submit" form="booking-form" disabled={submitting || !visibility.canSubmit} className="w-full mt-1">
        {submitting ? t("bookings.form.submitting") : t("bookings.form.submit")}
      </Button>
    </form>
  )
}
