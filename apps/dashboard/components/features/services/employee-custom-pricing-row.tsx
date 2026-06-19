"use client"

import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, Delete02Icon } from "@hugeicons/core-free-icons"
import { Badge, Button, Input } from "@sawaa/ui"
import { halalasToSarNumber, sarToHalalas } from "@/lib/money"
import type { ServiceEmployee } from "@/lib/types/service"
import type { SetPractitionerDurationsPayload } from "@/lib/api/employees"

interface Props {
  item: ServiceEmployee
  serviceId: string
  employeeId: string
  t: (key: string) => string
  isSaving: boolean
  onSave: (payload: SetPractitionerDurationsPayload) => void
}

const SUPPORTED = [
  { key: "in_person", dt: "IN_PERSON" as const, labelKey: "services.employees.durations.inPerson" },
  { key: "online", dt: "ONLINE" as const, labelKey: "services.employees.durations.online" },
]

interface Row {
  rid: string
  id?: string
  durationMins: number
  priceHalalas: number
  isInherited: boolean
  originalIsInherited: boolean
}

let RID = 0
const nextRid = () => `r${RID++}`

function rowsForType(item: ServiceEmployee, dt: "IN_PERSON" | "ONLINE"): Row[] {
  const group = (item.effectiveDurations ?? []).find(
    (g) => g.deliveryType.toUpperCase() === dt,
  )
  return (group?.durations ?? []).map((d) => ({
    rid: nextRid(),
    id: d.id,
    durationMins: d.durationMins,
    priceHalalas: d.price,
    isInherited: d.isInherited,
    originalIsInherited: d.isInherited,
  }))
}

export function EmployeeCustomPricingRow({
  item,
  serviceId: _serviceId,
  employeeId: _employeeId,
  t,
  isSaving,
  onSave,
}: Props) {
  const supported = SUPPORTED.filter((s) =>
    (item.availableTypes ?? []).some((a) => a.toLowerCase() === s.key),
  )

  const [rowsByType, setRowsByType] = useState<Record<string, Row[]>>(() => {
    const init: Record<string, Row[]> = {}
    for (const s of supported) init[s.dt] = rowsForType(item, s.dt)
    return init
  })

  const [dirty, setDirty] = useState(false)

  const update = (dt: string, next: Row[]) => {
    setRowsByType((p) => ({ ...p, [dt]: next }))
    setDirty(true)
  }

  const addRow = (dt: string) =>
    update(dt, [
      ...(rowsByType[dt] ?? []),
      {
        rid: nextRid(),
        durationMins: 60,
        priceHalalas: 0,
        isInherited: false,
        originalIsInherited: false,
      },
    ])

  const removeRow = (dt: string, rid: string) =>
    update(
      dt,
      (rowsByType[dt] ?? []).filter((r) => r.rid !== rid),
    )

  const editRow = (dt: string, rid: string, patch: Partial<Row>) =>
    update(
      dt,
      (rowsByType[dt] ?? []).map((r) =>
        r.rid === rid ? { ...r, ...patch, isInherited: false } : r,
      ),
    )

  const handleSave = () => {
    const durations = supported
      .map((s) => ({
        deliveryType: s.dt,
        items: (rowsByType[s.dt] ?? []).map((r) => {
          const base = {
            label: `${r.durationMins} min`,
            labelAr: `${r.durationMins} دقيقة`,
            durationMins: r.durationMins,
            price: r.priceHalalas,
          }
          return r.originalIsInherited || !r.id ? base : { id: r.id, ...base }
        }),
      }))
      .filter((g) => g.items.length > 0)
    onSave({ durations })
    setDirty(false)
  }

  const hasInheritedRows = Object.values(rowsByType).some((rows) =>
    rows.some((r) => r.isInherited),
  )

  return (
    <div className="flex flex-col gap-3">
      {hasInheritedRows && (
        <p className="text-[11px] text-muted-foreground leading-snug">
          {t("services.employees.durations.customizeHint")}
        </p>
      )}
      {supported.map((s) => {
        const rows = rowsByType[s.dt] ?? []
        return (
          <div key={s.dt} className="rounded-lg border border-border bg-surface p-2">
            <div className="mb-1.5 text-xs font-medium text-foreground">
              {t(s.labelKey)}
            </div>
            <div className="flex flex-col gap-1">
              {rows.map((r) => (
                <div key={r.rid} className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    className="h-8 w-20 tabular-nums"
                    aria-label={t("services.employees.durations.durationCol")}
                    value={r.durationMins}
                    onChange={(e) => {
                      const v = Number(e.target.value)
                      editRow(s.dt, r.rid, {
                        durationMins: Number.isFinite(v) && v >= 1 ? v : r.durationMins,
                      })
                    }}
                  />
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    className="h-8 w-24 tabular-nums"
                    aria-label={t("services.employees.durations.priceCol")}
                    value={halalasToSarNumber(r.priceHalalas)}
                    onChange={(e) =>
                      editRow(s.dt, r.rid, {
                        priceHalalas: sarToHalalas(Number(e.target.value)),
                      })
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur()
                    }}
                  />
                  {r.isInherited && (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">
                      {t("services.employees.durations.inherited")}
                    </Badge>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    aria-label={t("services.employees.durations.remove")}
                    onClick={() => removeRow(s.dt, r.rid)}
                  >
                    <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-3.5" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 justify-start gap-1.5 text-xs"
                onClick={() => addRow(s.dt)}
              >
                <HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="size-3.5" />
                {t("services.employees.durations.addRow")}
              </Button>
            </div>
          </div>
        )
      })}
      {dirty && (
        <Button
          type="button"
          size="sm"
          className="mt-1 h-7 self-end text-xs"
          disabled={isSaving}
          onClick={handleSave}
        >
          {t("services.employees.durations.save")}
        </Button>
      )}
    </div>
  )
}
