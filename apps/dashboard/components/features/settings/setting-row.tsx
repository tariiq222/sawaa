import type { ReactNode } from "react"
import { Input, Switch } from "@sawaa/ui"

export function SettingRow({
  label,
  desc,
  children,
}: {
  label: string
  desc: string
  children: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {children}
      </div>
    </div>
  )
}

export function NumberRow({
  label,
  desc,
  value,
  onChange,
  unit,
  min = 0,
  max,
}: {
  label: string
  desc: string
  value: string
  onChange: (v: string) => void
  unit: string
  min?: number
  max?: number
}) {
  return (
    <SettingRow label={label} desc={desc}>
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-20 tabular-nums"
        min={min}
        max={max}
      />
      <span className="w-8 text-xs text-muted-foreground">{unit}</span>
    </SettingRow>
  )
}

export function SwitchRow({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string
  desc: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <SettingRow label={label} desc={desc}>
      <Switch checked={checked} onCheckedChange={onChange} />
    </SettingRow>
  )
}
