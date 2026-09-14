"use client"

import { Button } from "@sawaa/ui"
import { useLocale } from "@/components/locale-provider"

export const PACKAGE_STEP_LABELS = [
  "packages.steps.details",
  "packages.steps.session",
  "packages.steps.pricing",
  "packages.steps.review",
] as const

interface Props {
  step: 1 | 2 | 3 | 4
  stepLabels?: readonly string[]
  isPending: boolean
  submitLabel: string
  onBack: () => void
  onNext: () => void
  onCancel: () => void
}

export function PackageEditorNavigation({
  step,
  stepLabels = PACKAGE_STEP_LABELS,
  isPending,
  submitLabel,
  onBack,
  onNext,
  onCancel,
}: Props) {
  const { t } = useLocale()
  return (
    <div className="sticky bottom-0 z-10 -mx-4 flex flex-col gap-3 border-t border-border bg-background px-4 py-3 sm:-mx-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <PackageStepProgress step={step} labels={stepLabels} />
      <div className="flex flex-col-reverse gap-2 sm:flex-row">
        <Button
          type="button"
          variant="ghost"
          size="lg"
          className="rounded-lg"
          onClick={onCancel}
        >
          {t(step === 1 ? "packages.create.cancel" : "packages.steps.cancel")}
        </Button>
        {step > 1 && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="rounded-lg"
            onClick={onBack}
            disabled={isPending}
          >
            {t("packages.steps.back")}
          </Button>
        )}
        {step < 4 ? (
          <Button
            key="package-editor-next"
            type="button"
            size="lg"
            className="rounded-lg"
            onMouseDown={(event) => event.preventDefault()}
            onClick={(event) => {
              event.preventDefault()
              onNext()
            }}
          >
            {t("packages.steps.next")}
          </Button>
        ) : (
          <Button
            key="package-editor-submit"
            type="submit"
            size="lg"
            className="rounded-lg"
            disabled={isPending}
          >
            {submitLabel}
          </Button>
        )}
      </div>
    </div>
  )
}

export function PackageStepProgress({ step, labels = PACKAGE_STEP_LABELS }: { step: 1 | 2 | 3 | 4; labels?: readonly string[] }) {
  const { t } = useLocale()
  return (
    <div
      className="flex flex-wrap gap-2"
      aria-label={t("packages.steps.label")}
    >
      {labels.map((label, index) => (
        <span
          key={label}
          aria-current={index + 1 === step ? "step" : undefined}
          className={`rounded-full px-2.5 py-1 text-xs ${index + 1 === step ? "bg-primary/10 font-medium text-foreground" : "text-muted-foreground"}`}
        >
          {index + 1}. {t(label)}
        </span>
      ))}
    </div>
  )
}
