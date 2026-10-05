'use client'
import { Input } from '@sawaa/ui'
import { useLocale } from '@/components/locale-provider'
import type { LateSessionDraft } from '@/lib/types/late-session'
export function LateTextField({
  field,
  draft,
  update,
  type = 'text',
}: {
  field: keyof LateSessionDraft
  draft: LateSessionDraft
  update: (patch: Partial<LateSessionDraft>) => void
  type?: string
}) {
  const { t } = useLocale()
  return (
    <label className="flex flex-col gap-2 text-sm">
      {t(`bookings.late.${field}`)}
      <Input
        type={type}
        value={draft[field]}
        onChange={(e) => update({ [field]: e.target.value })}
      />
    </label>
  )
}
export function LateSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <label className="flex flex-col gap-2 text-sm">
      {label}
      <select
        className="h-10 rounded-lg border border-border bg-surface px-3 text-foreground"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}
