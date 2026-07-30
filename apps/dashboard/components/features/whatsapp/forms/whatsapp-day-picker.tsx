"use client"

// whatsapp-day-picker — toggleable weekday buttons. Used by the AI settings
// form to scope when the agent replies. Buttons advertise aria-pressed so
// screen readers announce selection state.

import { Label } from "@sawaa/ui"
import { useLocale } from "@/components/locale-provider"

const DAYS = [
  { key: "sun", value: 0 },
  { key: "mon", value: 1 },
  { key: "tue", value: 2 },
  { key: "wed", value: 3 },
  { key: "thu", value: 4 },
  { key: "fri", value: 5 },
  { key: "sat", value: 6 },
] as const

interface WhatsappDayPickerProps {
  activeDays: number[]
  onToggle: (value: number) => void
  labelKey?: string
}

export function WhatsappDayPicker({
  activeDays,
  onToggle,
  labelKey = "whatsapp.ai.activeDays",
}: WhatsappDayPickerProps) {
  const { t } = useLocale()
  return (
    <div className="space-y-2">
      <Label>{t(labelKey)}</Label>
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label={t(labelKey)}
      >
        {DAYS.map((d) => (
          <button
            type="button"
            key={d.value}
            aria-pressed={activeDays.includes(d.value)}
            onClick={() => onToggle(d.value)}
            className={`rounded-md border px-3 py-1.5 text-sm transition ${
              activeDays.includes(d.value)
                ? "border-primary bg-primary/10 text-primary"
                : "border-border"
            }`}
          >
            {t(`whatsapp.ai.day.${d.key}`)}
          </button>
        ))}
      </div>
    </div>
  )
}
