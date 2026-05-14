"use client"

import { useState } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  UserAdd01Icon,
  User03Icon,
  Call02Icon,
  UserCircleIcon,
  IdentificationIcon,
  Location04Icon,
  BloodIcon,
  ArrowRight01Icon,
  ArrowLeft01Icon,
} from "@hugeicons/core-free-icons"

import { Button } from "@deqah/ui"
import { Input } from "@deqah/ui"
import { NationalitySelect } from "@/components/ui/nationality-select"
import { Label } from "@deqah/ui"
import { PhoneInput } from "@deqah/ui"
import { DatePicker } from "@/components/ui/date-picker"
import { Textarea } from "@deqah/ui"

import { createWalkInClient } from "@/lib/api/clients"
import { useLocale } from "@/components/locale-provider"
import { COUNTRIES } from "@/lib/countries-data"
import { cn } from "@/lib/utils"
import { BLOOD_TYPES, BLOOD_LABELS } from "@/lib/schemas/client.schema"
import {
  walkInClientSchema,
  type WalkInClientFormData,
} from "@/lib/schemas/booking.schema"

/* ── Card styles ── */

const card = "bg-surface rounded-xl border border-border shadow-sm overflow-hidden"
const cardHeader = "px-4 py-3 bg-surface border-b border-border"
const cardTitle = "text-xs font-semibold text-muted-foreground uppercase tracking-wider"
const cardBody = "px-4 py-4 flex flex-col gap-3"

/* ── FormField ── */

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

/* ── Step indicator ── */

function StepIndicator({ step, labels }: { step: 1 | 2; labels: [string, string] }) {
  return (
    <div className="flex items-center gap-3 w-fit">
      {([1, 2] as const).map((s, i) => {
        const active = step === s
        const done = step > s
        return (
          <div key={s} className="flex items-center gap-2">
            {i > 0 && (
              <div className={cn("h-px w-8 transition-colors", done ? "bg-primary" : "bg-border")} />
            )}
            <div className="flex items-center gap-1.5">
              <span className={cn(
                "flex size-5 items-center justify-center rounded-full text-[11px] font-semibold transition-colors",
                active ? "bg-primary text-primary-foreground" :
                done   ? "bg-primary/20 text-primary" :
                         "bg-border text-muted-foreground"
              )}>{s}</span>
              <span className={cn(
                "text-xs transition-colors whitespace-nowrap",
                active ? "text-foreground font-medium" :
                done   ? "text-primary" :
                         "text-muted-foreground"
              )}>{labels[i]}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ── Props ── */

interface BookingWalkInFormProps {
  onSelect: (clientId: string, name: string) => void
}

/* ── Step 1 fields for partial validation ── */

const step1Fields = ["firstName", "lastName", "phone"] as const

/* ── Main form ── */

export function BookingWalkInForm({ onSelect }: BookingWalkInFormProps) {
  const { t, locale } = useLocale()
  const defaultNationality = (() => {
    const sa = COUNTRIES.find((c) => c.code === "SA")
    if (!sa) return ""
    return locale === "ar" ? sa.ar : sa.en
  })()
  const form = useForm<WalkInClientFormData>({ resolver: zodResolver(walkInClientSchema) })
  const [step, setStep] = useState<1 | 2>(1)
  const [creating, setCreating] = useState(false)

  const bloodType = form.watch("bloodType")

  const goNext = async () => {
    const valid = await form.trigger(step1Fields)
    if (valid) setStep(2)
  }

  const handleCreate = form.handleSubmit(async (data) => {
    setCreating(true)
    try {
      const res = await createWalkInClient(data)
      toast.success(res.isExisting ? t("bookings.walkin.toast.existing") : t("bookings.walkin.toast.created"))
      onSelect(res.id, `${data.firstName} ${data.lastName}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("bookings.walkin.toast.error"))
    } finally {
      setCreating(false)
    }
  })

  return (
    <form onSubmit={handleCreate} className="flex flex-col gap-3">

      <StepIndicator step={step} labels={[t("bookings.walkin.step.personal"), t("bookings.walkin.step.medical")]} />

      {/* Step 1: Personal info + Contact */}
      {step === 1 && (
        <>
          <div className={card}>
            <div className={cardHeader}><p className={cardTitle}>{t("bookings.walkin.section.personalInfo")}</p></div>
            <div className={cardBody}>
              <div className="grid grid-cols-3 gap-3">
                <FormField label={t("bookings.walkin.field.firstName")} icon={<HugeiconsIcon icon={User03Icon} size={13} className="shrink-0" />} error={form.formState.errors.firstName?.message}>
                  <Input {...form.register("firstName")} placeholder={t("bookings.walkin.placeholder.firstName")} className="bg-surface-muted" />
                </FormField>
                <FormField label={t("bookings.walkin.field.middleName")} icon={<HugeiconsIcon icon={User03Icon} size={13} className="shrink-0" />}>
                  <Input {...form.register("middleName")} placeholder={t("bookings.walkin.placeholder.middleName")} className="bg-surface-muted" />
                </FormField>
                <FormField label={t("bookings.walkin.field.lastName")} icon={<HugeiconsIcon icon={User03Icon} size={13} className="shrink-0" />} error={form.formState.errors.lastName?.message}>
                  <Input {...form.register("lastName")} placeholder={t("bookings.walkin.placeholder.lastName")} className="bg-surface-muted" />
                </FormField>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <FormField label={t("bookings.walkin.field.gender")} icon={<HugeiconsIcon icon={UserCircleIcon} size={13} className="shrink-0" />}>
                  <Controller control={form.control} name="gender" render={({ field }) => (
                    <div className="flex gap-2">
                      {(["male", "female"] as const).map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => field.onChange(field.value === g ? undefined : g)}
                          className={cn(
                            "flex-1 rounded-md border py-2 text-xs font-medium transition-colors",
                            field.value === g
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-surface-muted text-muted-foreground hover:border-border-strong"
                          )}
                        >
                          {t(g === "male" ? "bookings.walkin.field.male" : "bookings.walkin.field.female")}
                        </button>
                      ))}
                    </div>
                  )} />
                </FormField>
                <FormField label={t("bookings.walkin.field.dateOfBirth")}>
                  <Controller control={form.control} name="dateOfBirth" render={({ field }) => (
                    <DatePicker value={field.value ?? ""} onChange={field.onChange} placeholder={t("bookings.walkin.placeholder.optional")} className="w-full bg-surface-muted" />
                  )} />
                </FormField>
                <FormField label={t("bookings.walkin.field.nationality")} icon={<HugeiconsIcon icon={Location04Icon} size={13} className="shrink-0" />}>
                  <Controller control={form.control} name="nationality" defaultValue={defaultNationality} render={({ field }) => (
                    <NationalitySelect
                      value={field.value ?? defaultNationality}
                      onChange={field.onChange}
                      locale={locale === "ar" ? "ar" : "en"}
                    />
                  )} />
                </FormField>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormField label={t("bookings.walkin.field.nationalId")} icon={<HugeiconsIcon icon={IdentificationIcon} size={13} className="shrink-0" />}>
                  <Input {...form.register("nationalId")} placeholder="1XXXXXXXXX" className="bg-surface-muted" dir="ltr" />
                </FormField>
                <FormField label={t("bookings.walkin.field.phone")} icon={<HugeiconsIcon icon={Call02Icon} size={13} className="shrink-0" />} error={form.formState.errors.phone?.message}>
                  <Controller control={form.control} name="phone" render={({ field }) => (
                    <PhoneInput value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} />
                  )} />
                </FormField>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormField label={t("bookings.walkin.field.emergencyName")}>
                  <Input {...form.register("emergencyName")} placeholder={t("bookings.walkin.placeholder.optional")} className="bg-surface-muted" />
                </FormField>
                <FormField label={t("bookings.walkin.field.emergencyPhone")} error={form.formState.errors.emergencyPhone?.message}>
                  <Controller control={form.control} name="emergencyPhone" render={({ field }) => (
                    <PhoneInput value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} />
                  )} />
                </FormField>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="button" size="sm" onClick={goNext}>
              {t("bookings.walkin.button.next")}
              <HugeiconsIcon icon={ArrowLeft01Icon} size={14} className="ms-1.5" />
            </Button>
          </div>
        </>
      )}

      {/* Step 2: Medical info */}
      {step === 2 && (
        <>
          <div className={card}>
            <div className={cardHeader}><p className={cardTitle}>{t("bookings.walkin.section.medicalInfo")}</p></div>
            <div className={cardBody}>
              <FormField label={t("bookings.walkin.field.bloodType")} icon={<HugeiconsIcon icon={BloodIcon} size={13} className="shrink-0" />}>
                <div className="grid grid-cols-4 gap-2">
                  {BLOOD_TYPES.filter((b) => b !== "UNKNOWN").map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => form.setValue("bloodType", bloodType === b ? undefined : b)}
                      className={cn(
                        "rounded-lg border py-1.5 text-xs font-semibold font-numeric transition-colors",
                        bloodType === b
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-surface-muted text-muted-foreground hover:border-border-strong"
                      )}
                    >
                      {BLOOD_LABELS[b]}
                    </button>
                  ))}
                </div>
              </FormField>
              <FormField label={t("bookings.walkin.field.allergies")}>
                <Textarea {...form.register("allergies")} placeholder={t("bookings.walkin.placeholder.allergies")} rows={2} className="bg-surface-muted resize-none" />
              </FormField>
              <FormField label={t("bookings.walkin.field.chronic")}>
                <Textarea {...form.register("chronicConditions")} placeholder={t("bookings.walkin.placeholder.chronic")} rows={2} className="bg-surface-muted resize-none" />
              </FormField>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Button type="button" variant="ghost" size="sm" onClick={() => setStep(1)} className="text-muted-foreground hover:text-foreground">
              <HugeiconsIcon icon={ArrowRight01Icon} size={14} className="me-1.5" />
              {t("bookings.walkin.button.previous")}
            </Button>
            <Button type="submit" size="sm" disabled={creating}>
              <HugeiconsIcon icon={UserAdd01Icon} size={14} className="me-1.5" />
              {creating ? t("bookings.walkin.button.creating") : t("bookings.walkin.button.createAndContinue")}
            </Button>
          </div>
        </>
      )}

    </form>
  )
}
