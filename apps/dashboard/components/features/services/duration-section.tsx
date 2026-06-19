"use client"

import { useState, useEffect, startTransition } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { PencilEdit01Icon, Tick01Icon, Delete01Icon } from "@hugeicons/core-free-icons"
import { Badge } from "@sawaa/ui"
import { Button } from "@sawaa/ui"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@sawaa/ui"
import { halalasToSarNumber } from "@/lib/money"
import type { PractitionerDurationGroup, PractitionerDurationItem } from "@/lib/types/service"

// ── Local row type ────────────────────────────────────────────────────────────

export interface DraftRow {
  _key: string
  id?: string
  durationMins: number
  price: number   // SAR (display)
  isInherited: boolean
}

export function toRows(items: PractitionerDurationItem[]): DraftRow[] {
  return items.map((item) => ({
    _key: item.id,
    id: item.id,
    durationMins: item.durationMins,
    price: halalasToSarNumber(item.price),
    isInherited: item.isInherited,
  }))
}

// ── Inline number field ───────────────────────────────────────────────────────

interface NumberFieldProps {
  value: number
  suffix: string
  isSaving: boolean
  min?: number
  step?: number
  ariaLabel: string
  onCommit: (next: number) => void
}

function InlineNumberField({ value, suffix, isSaving, min = 0, step = 1, ariaLabel, onCommit }: NumberFieldProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState("")

  if (editing) {
    return (
      <span className="flex items-center gap-1">
        <input
          type="number"
          className="w-20 rounded border border-border bg-background px-1.5 py-0.5 text-sm tabular-nums text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          value={draft}
          min={min}
          step={step}
          autoFocus
          disabled={isSaving}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const parsed = parseFloat(draft)
              if (!isNaN(parsed) && parsed >= min) { onCommit(parsed); setEditing(false) }
            } else if (e.key === "Escape") setEditing(false)
          }}
          onBlur={() => {
            const parsed = parseFloat(draft)
            if (!isNaN(parsed) && parsed >= min) onCommit(parsed)
            setEditing(false)
          }}
          aria-label={ariaLabel}
        />
        <button type="button" className="text-success hover:opacity-80" onClick={() => {
          const parsed = parseFloat(draft)
          if (!isNaN(parsed) && parsed >= min) { onCommit(parsed); setEditing(false) }
        }} aria-label="confirm">
          <HugeiconsIcon icon={Tick01Icon} strokeWidth={2} className="size-3.5" />
        </button>
      </span>
    )
  }

  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 text-sm tabular-nums text-foreground hover:text-primary disabled:opacity-50"
      disabled={isSaving}
      onClick={() => { setDraft(String(value)); setEditing(true) }}
      aria-label={ariaLabel}
    >
      <span>{value} {suffix}</span>
      <HugeiconsIcon icon={PencilEdit01Icon} strokeWidth={2} className="size-3 text-muted-foreground" />
    </button>
  )
}

// ── Per-delivery-type section ─────────────────────────────────────────────────

export interface SectionProps {
  group: PractitionerDurationGroup
  t: (key: string) => string
  isSaving: boolean
  onSaveGroup: (deliveryType: 'IN_PERSON' | 'ONLINE', rows: DraftRow[]) => void
}

export function DurationSection({ group, t, isSaving, onSaveGroup }: SectionProps) {
  const [rows, setRows] = useState<DraftRow[]>(() => toRows(group.durations))
  const [isDirty, setIsDirty] = useState(false)

  useEffect(() => {
    if (!isDirty) {
      startTransition(() => setRows(toRows(group.durations)))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.durations])

  const markDirty = () => setIsDirty(true)

  const updateRow = (key: string, patch: Partial<DraftRow>) => {
    setRows((prev) => prev.map((r) => r._key === key ? { ...r, ...patch, isInherited: false } : r))
    markDirty()
  }

  const deleteRow = (key: string) => {
    setRows((prev) => prev.filter((r) => r._key !== key))
    markDirty()
  }

  const addRow = () => {
    const newKey = `new-${Date.now()}`
    setRows((prev) => [...prev, { _key: newKey, durationMins: 60, price: 0, isInherited: false }])
    markDirty()
  }

  const handleSave = () => {
    onSaveGroup(group.deliveryType, rows)
    setIsDirty(false)
  }

  const sectionLabel = group.deliveryType === 'IN_PERSON'
    ? t("services.employees.durations.inPerson")
    : t("services.employees.durations.online")

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {sectionLabel}
        </p>
        {isDirty && (
          <Button type="button" size="sm" variant="default" className="h-7 text-xs" disabled={isSaving} onClick={handleSave}>
            {t("services.employees.durations.save")}
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground/70 px-1">
          {t("services.employees.durations.noDurations")}
        </p>
      ) : (
        <Table className="rounded-md border border-border bg-surface-muted/30">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-7 px-2 text-[10px]">{t("services.employees.durations.durationCol")}</TableHead>
              <TableHead className="h-7 px-2 text-[10px]">{t("services.employees.durations.priceCol")}</TableHead>
              <TableHead className="h-7 w-8 px-2" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row._key} className="hover:bg-transparent even:bg-transparent">
                <TableCell className="px-2 py-1.5">
                  <div className="flex items-center gap-1.5">
                    <InlineNumberField
                      value={row.durationMins}
                      suffix="د"
                      isSaving={isSaving}
                      min={1}
                      step={5}
                      ariaLabel={t("services.employees.durations.durationCol")}
                      onCommit={(v) => updateRow(row._key, { durationMins: Math.round(v), isInherited: false })}
                    />
                    {row.isInherited && (
                      <Badge variant="secondary" className="text-[9px] py-0 px-1 h-4 shrink-0">
                        {t("services.employees.durations.inherited")}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="px-2 py-1.5">
                  <InlineNumberField
                    value={row.price}
                    suffix={t("services.employees.durations.priceCol").split(" ").pop() ?? "ر.س"}
                    isSaving={isSaving}
                    min={0}
                    step={0.5}
                    ariaLabel={t("services.employees.durations.priceCol")}
                    onCommit={(v) => updateRow(row._key, { price: v, isInherited: false })}
                  />
                </TableCell>
                <TableCell className="px-2 py-1.5 w-8">
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-destructive disabled:opacity-50"
                    disabled={isSaving}
                    onClick={() => deleteRow(row._key)}
                    aria-label={t("services.employees.durations.remove")}
                  >
                    <HugeiconsIcon icon={Delete01Icon} strokeWidth={2} className="size-3.5" />
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <div className="flex items-center justify-between">
        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs gap-1" disabled={isSaving} onClick={addRow}>
          + {t("services.employees.durations.addRow")}
        </Button>
        {rows.length === 0 && isDirty && (
          <Button type="button" size="sm" variant="default" className="h-7 text-xs" disabled={isSaving} onClick={handleSave}>
            {t("services.employees.durations.save")}
          </Button>
        )}
      </div>
    </div>
  )
}
