"use client"

import { Controller } from "react-hook-form"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Stethoscope02Icon,
  MedicineBottle01Icon,
  Timer02Icon,
} from "@hugeicons/core-free-icons"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deqah/ui"
import { useLocale } from "@/components/locale-provider"
import type { UseFormReturn } from "react-hook-form"
import type { BookingCreateFormData } from "@/lib/schemas/booking.schema"
import type { Employee, EmployeeDurationOption, EmployeeService } from "@/lib/types/employee"
import type { ProgressiveVisibility } from "@/components/features/bookings/use-progressive-disclosure"
import { ProgressiveField } from "@/components/features/bookings/progressive-field"

/* ── FormField wrapper (local copy for this file) ── */

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
    <div className={`flex flex-col gap-1.5${className ? ` ${className}` : ""}`}>
      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

interface BookingEmployeeSectionProps {
  form: UseFormReturn<BookingCreateFormData>
  employees: Employee[]
  employeeServices: EmployeeService[]
  employeesLoading: boolean
  employeeServicesLoading: boolean
  availableTypes: string[]
  canFetchServiceTypes: boolean
  serviceTypesLoading: boolean
  hasDurationOptions: boolean
  durationOptions: EmployeeDurationOption[]
  visibility: ProgressiveVisibility
}

export function BookingEmployeeSection({
  form,
  employees,
  employeeServices,
  employeesLoading,
  employeeServicesLoading,
  availableTypes,
  canFetchServiceTypes,
  serviceTypesLoading,
  hasDurationOptions: _hasDurationOptions,
  durationOptions,
  visibility,
}: BookingEmployeeSectionProps) {
  const { t, locale } = useLocale()

  return (
    <div className="px-4 py-4 flex flex-col gap-3">
      {/* Employee — always visible */}
      <FormField
        label={t("bookings.form.label.employee")}
        icon={<HugeiconsIcon icon={Stethoscope02Icon} size={13} className="shrink-0" />}
        error={form.formState.errors.employeeId?.message}
      >
        <Controller control={form.control} name="employeeId" render={({ field }) => (
          <Select value={field.value} onValueChange={field.onChange}>
            <SelectTrigger className="bg-surface-muted border-border">
              <SelectValue placeholder={employeesLoading ? t("bookings.form.placeholder.loading") : t("bookings.form.placeholder.selectEmployee")} />
            </SelectTrigger>
            <SelectContent>
              {employees.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {t("bookings.info.drPrefix")} {p.user.firstName} {p.user.lastName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )} />
      </FormField>

      {/* Service */}
      <ProgressiveField show={visibility.showService}>
        <FormField
          label={t("bookings.form.label.service")}
          icon={<HugeiconsIcon icon={MedicineBottle01Icon} size={13} className="shrink-0" />}
          error={form.formState.errors.serviceId?.message}
        >
          <Controller control={form.control} name="serviceId" render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="bg-surface-muted border-border">
                <SelectValue placeholder={employeeServicesLoading ? t("bookings.form.placeholder.loading") : t("bookings.form.placeholder.selectService")} />
              </SelectTrigger>
              <SelectContent>
                {employeeServices.map((ps) => (
                  <SelectItem key={ps.serviceId} value={ps.serviceId}>{ps.service.nameAr}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )} />
        </FormField>
      </ProgressiveField>

      {/* Booking Type — filtered to what this employee+service supports */}
      <ProgressiveField show={visibility.showType}>
        <FormField label={t("bookings.form.label.bookingType")}>
          <Controller control={form.control} name="type" render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="bg-surface-muted border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(!availableTypes.length || availableTypes.includes("in_person")) && (
                  <SelectItem value="in_person">{t("bookings.form.type.inPerson")}</SelectItem>
                )}
                {(!availableTypes.length || availableTypes.includes("online")) && (
                  <SelectItem value="online">{t("bookings.form.type.online")}</SelectItem>
                )}
                {(!availableTypes.length || availableTypes.includes("walk_in")) && (
                  <SelectItem value="walk_in">{t("bookings.form.type.walkIn")}</SelectItem>
                )}
              </SelectContent>
            </Select>
          )} />
        </FormField>
      </ProgressiveField>

      {/* Duration — conditional on service types */}
      <ProgressiveField show={visibility.showDuration && canFetchServiceTypes && !serviceTypesLoading}>
        <FormField label={t("bookings.form.label.sessionDuration")} icon={<HugeiconsIcon icon={Timer02Icon} size={13} className="shrink-0" />}>
          <Controller control={form.control} name="durationOptionId" render={({ field }) => (
            <Select value={field.value ?? ""} onValueChange={field.onChange}>
              <SelectTrigger className="bg-surface-muted border-border"><SelectValue placeholder={t("bookings.form.placeholder.selectDuration")} /></SelectTrigger>
              <SelectContent>
                {durationOptions.sort((a, b) => a.sortOrder - b.sortOrder).map((opt) => (
                  <SelectItem key={opt.id} value={opt.id} className="font-numeric">
                    {(locale === "ar" ? opt.labelAr : opt.label) || opt.label} ({opt.durationMinutes} {t("bookings.minutesAbbrev")})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )} />
        </FormField>
      </ProgressiveField>
    </div>
  )
}
