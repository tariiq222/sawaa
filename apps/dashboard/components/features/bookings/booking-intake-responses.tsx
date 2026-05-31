"use client"

import { Badge } from "@sawaa/ui"

import { useLocale } from "@/components/locale-provider"
import { useBookingIntakeResponses } from "@/hooks/use-intake-forms"
import type {
  IntakeFieldApi,
  IntakeResponseApi,
} from "@/lib/types/intake-form-api"

/* ── Helpers ── */

function fieldLabel(field: IntakeFieldApi, locale: "ar" | "en"): string {
  return locale === "ar"
    ? field.labelAr || field.labelEn
    : field.labelEn || field.labelAr
}

function formName(form: IntakeResponseApi["form"], locale: "ar" | "en"): string {
  return locale === "ar"
    ? form.nameAr || form.nameEn
    : form.nameEn || form.nameAr
}

/** Render a single answer (string | string[]) into a display node. */
function AnswerValue({ value }: { value: string | string[] | undefined }) {
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-muted-foreground">—</span>
    return (
      <div className="flex flex-wrap gap-1.5">
        {value.map((v, i) => (
          <Badge
            key={`${v}-${i}`}
            variant="outline"
            className="text-xs border-border bg-muted text-foreground"
          >
            {v}
          </Badge>
        ))}
      </div>
    )
  }
  if (value == null || value === "") {
    return <span className="text-muted-foreground">—</span>
  }
  return <span className="text-sm text-foreground leading-relaxed">{value}</span>
}

/* ── Single response card ── */

function ResponseCard({ response }: { response: IntakeResponseApi }) {
  const { locale, t } = useLocale()
  const { form, answers } = response

  const card = "bg-surface rounded-xl border border-border shadow-sm overflow-hidden"
  const cardHeader = "px-4 py-2.5 bg-muted/50 border-b border-border flex items-center justify-between gap-2"
  const cardTitle = "text-sm font-semibold text-foreground"
  const cardBody = "px-4 py-3 flex flex-col gap-3"

  const scopeLabel =
    form.scopeLabel || t(`intakeForms.scope.${form.scope}`) || form.scope
  const typeLabel = t(`intakeForms.type.${form.type}`) || form.type

  const orderedFields = [...form.fields].sort((a, b) => a.position - b.position)

  return (
    <div className={card}>
      <div className={cardHeader}>
        <p className={cardTitle}>{formName(form, locale)}</p>
        <div className="flex items-center gap-1.5">
          <Badge
            variant="outline"
            className="text-xs border-primary/30 bg-primary/10 text-primary"
          >
            {typeLabel}
          </Badge>
          <Badge
            variant="outline"
            className="text-xs border-border bg-muted text-muted-foreground"
          >
            {scopeLabel}
          </Badge>
        </div>
      </div>
      <div className={cardBody}>
        {orderedFields.map((field) => (
          <div key={field.id} className="flex flex-col gap-1">
            <p className="text-xs font-medium text-muted-foreground">
              {fieldLabel(field, locale)}
            </p>
            <AnswerValue value={answers[field.id]} />
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Panel ── */

export function BookingIntakeResponses({ bookingId }: { bookingId: string }) {
  const { t } = useLocale()
  const { data, isLoading, error } = useBookingIntakeResponses(bookingId)

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("intakeForms.responses.loading")}
      </p>
    )
  }

  if (error) {
    return (
      <p className="text-sm text-destructive">
        {t("intakeForms.responses.error")}
      </p>
    )
  }

  const responses = data ?? []

  if (responses.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("intakeForms.responses.empty")}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {responses.map((response) => (
        <ResponseCard key={response.id} response={response} />
      ))}
    </div>
  )
}
