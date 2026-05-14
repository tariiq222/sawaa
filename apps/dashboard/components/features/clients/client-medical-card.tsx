"use client"

import { Controller } from "react-hook-form"
import type { UseFormReturn } from "react-hook-form"
import { HeartCheckIcon } from "@hugeicons/core-free-icons"
import { Card, CardContent } from "@deqah/ui"
import { Textarea } from "@deqah/ui"
import { cn } from "@/lib/utils"
import { useLocale } from "@/components/locale-provider"
import { SectionHeader } from "@/components/features/section-header"
import { BLOOD_TYPES, BLOOD_LABELS, type CreateClientFormData, type EditClientFormData } from "@/lib/schemas/client.schema"
import { Field } from "@/components/features/clients/client-form"

interface ClientMedicalCardProps {
  form: UseFormReturn<CreateClientFormData> | UseFormReturn<EditClientFormData>
  isCreate: boolean
}

export function ClientMedicalCard({ form, isCreate }: ClientMedicalCardProps) {
  const { control, register } = form as UseFormReturn<EditClientFormData>
  const { t } = useLocale()

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <SectionHeader
          icon={HeartCheckIcon}
          title={isCreate
            ? t("clients.form.medicalBasics")
            : t("clients.form.medicalInfo")}
          description={isCreate ? t("clients.form.medicalBasicsDesc") : undefined}
        />

        <Field label={t("clients.form.bloodType")}>
          <Controller
            control={control}
            name="bloodType"
            render={({ field }) => (
              <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label={t("clients.form.bloodType")}>
                {BLOOD_TYPES.filter((b) => b !== "UNKNOWN").map((val) => (
                  <button
                    key={val}
                    type="button"
                    role="radio"
                    aria-checked={field.value === val}
                    onClick={() => field.onChange(field.value === val ? undefined : val)}
                    className={cn(
                      "rounded-lg border py-2 text-sm font-medium tabular-nums transition-colors",
                      field.value === val
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    )}
                  >
                    {BLOOD_LABELS[val]}
                  </button>
                ))}
              </div>
            )}
          />
        </Field>

        <Field label={t("clients.form.allergies")}>
          <Textarea
            {...register("allergies")}
            placeholder={t("clients.form.allergiesPlaceholder")}
            rows={3}
          />
        </Field>

        <Field label={t("clients.form.chronicConditions")}>
          <Textarea
            {...register("chronicConditions")}
            placeholder={t("clients.form.chronicPlaceholder")}
            rows={3}
          />
        </Field>
      </CardContent>
    </Card>
  )
}
