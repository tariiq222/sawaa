"use client"

import { useId, isValidElement, cloneElement } from "react"
import { UseFormReturn, Controller, FieldErrors } from "react-hook-form"
import { Input } from "@sawaa/ui"
import { NationalitySelect } from "@/components/ui/nationality-select"
import { PhoneInput } from "@sawaa/ui"
import { Label } from "@sawaa/ui"
import { Switch } from "@sawaa/ui"
import { DatePicker } from "@/components/ui/date-picker"
import { cn } from "@/lib/utils"
import { useLocale } from "@/components/locale-provider"
import { FormSection } from "@/components/features/shared/form-section"
import {
  type CreateClientFormData,
  type EditClientFormData,
} from "@/lib/schemas/client.schema"
import { ClientMedicalCard } from "@/components/features/clients/client-medical-card"

/* ─── Internal helper types ─── */

/** Union of both form schemas — allows ClientFormFields to accept create or edit forms. */
type ClientFormData = CreateClientFormData | EditClientFormData

/* ─── Field ─── */

export function Field({ label, error, children, required, htmlFor: htmlForProp }: {
  label: string
  error?: string
  children: React.ReactNode
  required?: boolean
  htmlFor?: string
}) {
  const generatedId = useId()
  const id = htmlForProp ?? generatedId
  const errorId = `${id}-error`

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}{required && " *"}</Label>
      {isValidElement(children)
        ? cloneElement(
            children as React.ReactElement<{
              id?: string
              "aria-invalid"?: boolean | "true" | "false"
              "aria-describedby"?: string
            }>,
            {
              id,
              ...(error
                ? { "aria-invalid": "true", "aria-describedby": errorId }
                : {}),
            },
          )
        : children}
      {error && <p id={errorId} className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

/* ─── ClientFormFields ─── */

interface ClientFormFieldsProps {
  form: UseFormReturn<CreateClientFormData> | UseFormReturn<EditClientFormData>
  errors: FieldErrors<ClientFormData>
  mode: "create" | "edit"
}

export function ClientFormFields({ form, errors, mode }: ClientFormFieldsProps) {
  const { control, register } = form as UseFormReturn<EditClientFormData>
  const { t, locale } = useLocale()
  const isCreate = mode === "create"

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

      {/* ── Section 1: Personal ── */}
      <FormSection
        title={t("clients.form.personalInfo")}
        description={t("clients.form.personalInfoDesc")}
      >
        <div className="space-y-4">
          <Field
            label={t("clients.form.fullName")}
            error={errors.fullName?.message}
            required={isCreate}
          >
            <Input {...register("fullName")} />
          </Field>

          <Field label={t("clients.form.gender")}>
            <Controller
              control={control}
              name="gender"
              render={({ field }) => (
                <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t("clients.form.gender")}>
                  {(["male", "female"] as const).map((val) => (
                    <button
                      key={val}
                      type="button"
                      role="radio"
                      aria-checked={field.value === val}
                      onClick={() => field.onChange(field.value === val ? undefined : val)}
                      className={cn(
                        "rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
                        field.value === val
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      )}
                    >
                      {val === "male" ? t("clients.form.male") : t("clients.form.female")}
                    </button>
                  ))}
                </div>
              )}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t("clients.form.dateOfBirth")}>
              <Controller
                control={control}
                name="dateOfBirth"
                render={({ field }) => (
                  <DatePicker
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    maxDate={new Date().toISOString().split("T")[0]}
                    error={!!errors.dateOfBirth}
                    suppressHydrationWarning
                  />
                )}
              />
            </Field>
            <Field label={t("clients.form.nationality")}>
              <Controller
                control={control}
                name="nationality"
                defaultValue={t("clients.form.defaultNationality")}
                render={({ field }) => (
                  <NationalitySelect
                    value={field.value ?? t("clients.form.defaultNationality")}
                    onChange={field.onChange}
                    locale={locale}
                  />
                )}
              />
            </Field>
          </div>

          <Field label={t("clients.form.nationalId")}>
            <Input
              {...register("nationalId")}
              placeholder="1XXXXXXXXX"
              dir="ltr"
              className="tabular-nums"
            />
          </Field>

          {!isCreate && (
            <Controller
              control={control}
              name="isActive"
              render={({ field }) => (
                <div className="flex h-9 items-center justify-between rounded-lg border border-border px-3">
                  <Label htmlFor="client-active" className="cursor-pointer text-sm">
                    {t("clients.form.accountActive")}
                  </Label>
                  <Switch
                    id="client-active"
                    checked={field.value ?? true}
                    onCheckedChange={field.onChange}
                  />
                </div>
              )}
            />
          )}
        </div>
      </FormSection>

      {/* ── Section 2: Contact + Emergency ── */}
      <FormSection
        title={t("clients.form.contactInfo")}
        description={isCreate ? t("clients.form.phoneDesc") : undefined}
      >
        <div className="space-y-4">
          <Field
            label={t("clients.form.phone")}
            error={errors.phone?.message}
            required={isCreate}
          >
            <Controller
              control={control}
              name="phone"
              render={({ field }) => (
                <PhoneInput
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                />
              )}
            />
          </Field>

          {isCreate && (
            <p className="text-xs text-muted-foreground rounded-lg bg-muted/50 px-3 py-2.5">
              {t("clients.form.phoneHint")}
            </p>
          )}

          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-2">
            {t("clients.form.emergencyContact")}
          </h3>
          {isCreate && (
            <p className="text-xs text-muted-foreground">
              {t("clients.form.emergencyContactDesc")}
            </p>
          )}

          <Field label={t("clients.form.name")}>
            <Input {...register("emergencyName")} />
          </Field>
          <Field label={t("clients.form.phone")} error={errors.emergencyPhone?.message}>
            <Controller
              control={control}
              name="emergencyPhone"
              render={({ field }) => (
                <PhoneInput
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                />
              )}
            />
          </Field>
        </div>
      </FormSection>

      {/* ── Card 3: Medical ── */}
      <ClientMedicalCard form={form} isCreate={isCreate} />

    </div>
  )
}
