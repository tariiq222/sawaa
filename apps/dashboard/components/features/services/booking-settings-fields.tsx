"use client"

import { Input } from "@deqah/ui"
import { Label } from "@deqah/ui"
import { Switch } from "@deqah/ui"
import { cn } from "@/lib/utils"

/* ─── Number Field with optional hint ─── */

export function NumberField({ id, label, value, onChange, unit, min, max, hint }: {
  id: string
  label: string
  value: number | string
  onChange: (v: number | null) => void
  unit: string
  min: number
  max?: number
  hint?: string
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-3 space-y-1 transition-colors duration-200">
      <div className="flex items-center justify-between">
        <Label htmlFor={id} className="cursor-pointer text-sm">
          {label}
        </Label>
        <div className="flex items-center gap-2">
          <Input
            id={id}
            type="number"
            value={value}
            onChange={(e) => {
              const raw = e.target.value
              onChange(raw === "" ? null : Number(raw))
            }}
            className="w-20 tabular-nums"
            min={min}
            max={max}
          />
          {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
        </div>
      </div>
      {hint && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  )
}

/* ─── Switch Field — binary enable/disable ─── */

export function SwitchField({ id, label, description, checked, onCheckedChange }: {
  id: string
  label: string
  description?: string
  checked: boolean
  onCheckedChange: (v: boolean) => void
}) {
  return (
    <div className={cn(
      "space-y-2 rounded-lg border p-3 transition-colors duration-200",
      checked
        ? "border-primary/30 bg-primary/[0.03]"
        : "border-border bg-background",
    )}>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id} className="cursor-pointer text-sm">
          {label}
        </Label>
        <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
      </div>
      {description && (
        <p className="text-xs text-muted-foreground/70">{description}</p>
      )}
    </div>
  )
}

/* ─── Override Field — uses global default or custom value ─── */

export function OverrideField({ id, label, description, value, defaultValue: _defaultValue, unit, globalHint, min, max, onEnable, onDisable, onChange }: {
  id: string
  label: string
  description?: string
  value: number | null | undefined
  defaultValue: number
  unit: string
  globalHint: string
  min: number
  max?: number
  onEnable: () => void
  onDisable: () => void
  onChange: (v: number | null) => void
}) {
  const isCustom = value != null

  return (
    <div className={cn(
      "space-y-2 rounded-lg border p-3 transition-colors duration-200",
      isCustom
        ? "border-primary/30 bg-primary/[0.03]"
        : "border-border bg-background",
    )}>
      {/* Header: label + switch (consistent with SwitchField) */}
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={`${id}-toggle`} className="cursor-pointer text-sm">
          {label}
        </Label>
        <Switch
          id={`${id}-toggle`}
          checked={isCustom}
          onCheckedChange={(checked) => {
            if (checked) onEnable()
            else onDisable()
          }}
        />
      </div>

      {/* Description */}
      {description && (
        <p className="text-xs text-muted-foreground/70">{description}</p>
      )}

      {/* Value input when active, global hint when inactive */}
      {isCustom ? (
        <div className="flex items-center gap-2">
          <Input
            id={id}
            type="number"
            value={value ?? ""}
            onChange={(e) => {
              const raw = e.target.value
              onChange(raw === "" ? null : Number(raw))
            }}
            className="w-20 tabular-nums"
            min={min}
            max={max}
          />
          <span className="text-xs text-muted-foreground">{unit}</span>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{globalHint}</p>
      )}
    </div>
  )
}
