"use client"

/**
 * Package item builder — Sawaa Dashboard
 *
 * `useFieldArray` over a list of `packages.items[i]`. Each row picks:
 *
 *   service       →  from a flat list of all services
 *   practitioner  →  from `useServiceEmployees(serviceId)` (auto-filtered
 *                    to the practitioners who actually offer the service)
 *   duration      →  from `useDurationOptions(serviceId)` (the service's
 *                    own duration options; if the practitioner has a
 *                    `useCustomPricing` override, we additionally surface
 *                    their `effectiveDurations` group with the override
 *                    price so the live preview shows the real number)
 *   paid / free   →  integer >= 0
 *
 * The form's `watch` reads the rendered `paidQuantity × unitPrice` so the
 * live `PackagePriceSummary` updates as the user edits. Each row also
 * calls `onLineTotalChange(index, total)` so the parent form can sum the
 * line totals into a package-level subtotal without re-querying per row.
 */

import { useEffect, useMemo } from "react"
import {
  Controller,
  useFieldArray,
  useFormContext,
  type UseFormRegister,
  type Control,
  type UseFormWatch,
} from "react-hook-form"
import { HugeiconsIcon } from "@hugeicons/react"
import { Cancel01Icon } from "@hugeicons/core-free-icons"

import { Input } from "@sawaa/ui"
import { Label } from "@sawaa/ui"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@sawaa/ui"
import { Button } from "@sawaa/ui"

import { useAllServices, useServiceEmployees, useDurationOptions } from "@/hooks/use-services"
import { useLocale } from "@/components/locale-provider"
import { formatPrice } from "@/lib/money"
import type { ServiceEmployee, ServiceDurationOption, Service } from "@/lib/types/service"

/* ─── Public shape ─── */

export interface PackageItemBuilderProps {
  /** RHF field-array name, e.g. `"items"`. */
  fieldArrayName: string
  /** Called when a row's line total changes. Index = row position. */
  onLineTotalChange?: (index: number, lineTotal: number) => void
}

/* ─── Helpers ─── */

const NONE = "__none__"

/**
 * Resolves a representative unit price (halalas) for a given item row.
 * - If the practitioner has an `effectiveDurations` entry matching this
 *   duration, that override wins; otherwise the service-default duration
 *   option price is used (mirrors `ComputePackagePriceService.resolveUnitPrice`).
 * - Returns 0 if no duration is selected.
 */
export function resolveItemUnitPrice(
  selectedDuration: ServiceDurationOption | undefined,
  selectedEmployee: ServiceEmployee | undefined,
): number {
  if (!selectedDuration) return 0
  const base = Number(selectedDuration.price) || 0
  if (!selectedEmployee) return base
  const override = selectedEmployee.effectiveDurations
    ?.flatMap((g) => g.durations)
    ?.find((d) => d.durationMins === selectedDuration.durationMins)
  if (override && override.price != null) return Number(override.price) || base
  return base
}

/* ─── Component ─── */

export function PackageItemBuilder({ fieldArrayName, onLineTotalChange }: PackageItemBuilderProps) {
  const { t } = useLocale()
  const formCtx = useFormContext()
  const { control, register, watch, setValue } = formCtx
  const { fields, append, remove } = useFieldArray({ control, name: fieldArrayName })

  const { services } = useAllServices()

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">{t("packages.items.title")}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{t("packages.items.description")}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            append({
              serviceId: "",
              employeeId: "",
              durationOptionId: "",
              paidQuantity: 1,
              freeQuantity: 0,
              sortOrder: fields.length,
            })
          }
        >
          {t("packages.items.addItem")}
        </Button>
      </div>

      {fields.length === 0 ? (
        <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
          {t("packages.items.empty")}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {fields.map((field, index) => (
            <ItemRow
              key={field.id}
              index={index}
              fieldArrayName={fieldArrayName}
              onRemove={() => remove(index)}
              onLineTotalChange={onLineTotalChange}
              services={services}
              register={register as UseFormRegister<Record<string, unknown>>}
              control={control as unknown as Control<Record<string, unknown>>}
              watch={watch as unknown as UseFormWatch<Record<string, unknown>>}
              setValue={setValue}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── Row ─── */

interface ItemRowProps {
  index: number
  fieldArrayName: string
  onRemove: () => void
  onLineTotalChange?: (index: number, lineTotal: number) => void
  services: Service[]
  register: UseFormRegister<Record<string, unknown>>
  control: Control<Record<string, unknown>>
  watch: UseFormWatch<Record<string, unknown>>
  setValue: ReturnType<typeof useFormContext>["setValue"]
}

function ItemRow({
  index,
  fieldArrayName,
  onRemove,
  onLineTotalChange,
  services,
  register,
  control,
  watch,
  setValue,
}: ItemRowProps) {
  const { t, locale } = useLocale()
  const servicePath = `${fieldArrayName}.${index}.serviceId`
  const employeePath = `${fieldArrayName}.${index}.employeeId`
  const durationPath = `${fieldArrayName}.${index}.durationOptionId`
  const paidPath = `${fieldArrayName}.${index}.paidQuantity`
  const freePath = `${fieldArrayName}.${index}.freeQuantity`

  const selectedServiceId = (watch(servicePath) as string | undefined) || ""
  const selectedEmployeeId = (watch(employeePath) as string | undefined) || ""
  const paid = Number(watch(paidPath) ?? 0)

  const { data: employees = [], isLoading: isLoadingEmployees } =
    useServiceEmployees(selectedServiceId)
  const { data: durations = [], isLoading: isLoadingDurations } =
    useDurationOptions(selectedServiceId)

  const selectedDuration = useMemo(
    () => durations.find((d) => d.id === watch(durationPath)),
    [durations, watch, durationPath],
  )
  const selectedEmployee = useMemo(
    () => employees.find((e) => e.employee.id === selectedEmployeeId),
    [employees, selectedEmployeeId],
  )
  const unitPrice = resolveItemUnitPrice(selectedDuration, selectedEmployee)
  const lineTotal = paid * unitPrice

  // Report line total upward whenever it changes (live price summary).
  useEffect(() => {
    onLineTotalChange?.(index, lineTotal)
  }, [index, lineTotal, onLineTotalChange])

  return (
    <div className="rounded-lg border p-3 flex flex-col gap-3 bg-background">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs text-muted-foreground tabular-nums">
          #{index + 1}
        </span>
        <button
          type="button"
          onClick={onRemove}
          aria-label={t("packages.items.remove")}
          className="text-muted-foreground hover:text-destructive transition-colors"
        >
          <HugeiconsIcon icon={Cancel01Icon} size={16} />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {/* Service */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={servicePath as string}>{t("packages.items.service")}</Label>
          <Controller
            control={control}
            name={servicePath}
            render={({ field }) => (
              <Select
                value={(field.value as string) || NONE}
                onValueChange={(v) => {
                  const next = v === NONE ? "" : v
                  field.onChange(next)
                  // Reset dependent fields when the service changes.
                  setValue(employeePath, "" as never, { shouldDirty: true })
                  setValue(durationPath, "" as never, { shouldDirty: true })
                }}
              >
                <SelectTrigger id={servicePath as string}>
                  <SelectValue placeholder={t("packages.items.servicePlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {services.map((s) => {
                    const name = locale === "ar" ? s.nameAr : (s.nameEn ?? s.nameAr)
                    return (
                      <SelectItem key={s.id} value={s.id}>
                        {name}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        {/* Practitioner */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={employeePath as string}>{t("packages.items.employee")}</Label>
          <Controller
            control={control}
            name={employeePath}
            render={({ field }) => (
              <Select
                value={(field.value as string) || NONE}
                onValueChange={(v) => field.onChange(v === NONE ? "" : v)}
                disabled={!selectedServiceId || isLoadingEmployees}
              >
                <SelectTrigger id={employeePath as string}>
                  <SelectValue
                    placeholder={
                      !selectedServiceId
                        ? t("packages.items.servicePlaceholder")
                        : isLoadingEmployees
                          ? t("common.loading")
                          : employees.length === 0
                            ? t("packages.items.practitionerUnavailable")
                            : t("packages.items.employeePlaceholder")
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {employees.length === 0 ? (
                    <SelectItem value={NONE} disabled>
                      {t("packages.items.practitionerUnavailable")}
                    </SelectItem>
                  ) : (
                    employees.map((e) => (
                      <SelectItem key={e.employee.id} value={e.employee.id}>
                        {[
                          e.employee.user?.firstName,
                          e.employee.user?.lastName,
                        ]
                          .filter(Boolean)
                          .join(" ") || e.employee.id.slice(0, 8)}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        {/* Duration */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={durationPath as string}>{t("packages.items.duration")}</Label>
          <Controller
            control={control}
            name={durationPath}
            render={({ field }) => (
              <Select
                value={(field.value as string) || NONE}
                onValueChange={(v) => field.onChange(v === NONE ? "" : v)}
                disabled={!selectedServiceId || isLoadingDurations}
              >
                <SelectTrigger id={durationPath as string}>
                  <SelectValue
                    placeholder={
                      !selectedServiceId
                        ? t("packages.items.servicePlaceholder")
                        : isLoadingDurations
                          ? t("common.loading")
                          : durations.length === 0
                            ? t("packages.items.durationUnavailable")
                            : t("packages.items.durationPlaceholder")
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {durations.length === 0 ? (
                    <SelectItem value={NONE} disabled>
                      {t("packages.items.durationUnavailable")}
                    </SelectItem>
                  ) : (
                    durations.map((d) => {
                      const label = d.labelAr ?? d.label
                      const empOverride = selectedEmployee?.effectiveDurations
                        ?.flatMap((g) => g.durations)
                        ?.find((x) => x.durationMins === d.durationMins)
                      const displayPrice = empOverride?.price ?? d.price
                      return (
                        <SelectItem key={d.id} value={d.id}>
                          {label} · {d.durationMins} {t("common.min")} · {formatPrice(Number(displayPrice))}
                        </SelectItem>
                      )
                    })
                  )}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={paidPath as string}>{t("packages.items.paidQuantity")}</Label>
          <Input
            id={paidPath as string}
            type="number"
            min={0}
            className="tabular-nums"
            {...register(paidPath, { valueAsNumber: true })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={freePath as string}>{t("packages.items.freeQuantity")}</Label>
          <Input
            id={freePath as string}
            type="number"
            min={0}
            className="tabular-nums"
            {...register(freePath, { valueAsNumber: true })}
          />
        </div>
      </div>

      {selectedDuration && (
        <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-2">
          <span>
            {paid} × {formatPrice(unitPrice)}
          </span>
          <span className="tabular-nums font-semibold text-foreground">
            {formatPrice(lineTotal)}
          </span>
        </div>
      )}
    </div>
  )
}
