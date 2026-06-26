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
import { formatPrice, sarToHalalas } from "@/lib/money"
import { applyItemDiscount } from "@/lib/package-price"
import type { ServiceEmployee, ServiceDurationOption, Service } from "@/lib/types/service"
import type { PackageDiscountType } from "@/lib/types/package"

/* ─── Public shape ─── */

/**
 * Resolved per-row pricing detail, surfaced to the live price summary.
 * `discountValue` is in storage scale (PERCENTAGE 0-100 | FIXED halalas).
 */
export interface PackageLineDetail {
  serviceName: string
  paidQuantity: number
  freeQuantity: number
  unitPrice: number
  discountType: PackageDiscountType | null
  discountValue: number
}

export interface PackageItemBuilderProps {
  /** RHF field-array name, e.g. `"items"`. */
  fieldArrayName: string
  /** Called when a row's resolved pricing detail changes. Index = row position. */
  onLineChange?: (index: number, detail: PackageLineDetail) => void
}

/* ─── Helpers ─── */

const NONE = "__none__"
const DISCOUNT_NONE = "__no_discount__"

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

export function PackageItemBuilder({ fieldArrayName, onLineChange }: PackageItemBuilderProps) {
  const { t } = useLocale()
  const formCtx = useFormContext()
  const { control, register, watch, setValue } = formCtx
  const { fields, append, remove } = useFieldArray({ control, name: fieldArrayName })

  const { services } = useAllServices()

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-end">
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
              discountType: null,
              discountValue: 0,
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
              onLineChange={onLineChange}
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
  onLineChange?: (index: number, detail: PackageLineDetail) => void
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
  onLineChange,
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
  const discountTypePath = `${fieldArrayName}.${index}.discountType`
  const discountValuePath = `${fieldArrayName}.${index}.discountValue`

  const selectedServiceId = (watch(servicePath) as string | undefined) || ""
  const selectedEmployeeId = (watch(employeePath) as string | undefined) || ""
  const paid = Number(watch(paidPath) ?? 0)
  const free = Number(watch(freePath) ?? 0)
  const discountType = (watch(discountTypePath) as PackageDiscountType | null | undefined) ?? null
  const rawDiscountValue = Number(watch(discountValuePath) ?? 0)
  // FIXED is entered in SAR on the form; convert to halalas for the live math.
  const storageDiscountValue = discountType === "FIXED" ? sarToHalalas(rawDiscountValue) : rawDiscountValue

  const selectedService = services.find((s) => s.id === selectedServiceId)
  const serviceName = selectedService
    ? locale === "ar"
      ? selectedService.nameAr
      : (selectedService.nameEn ?? selectedService.nameAr)
    : ""

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
  const payable = paid * unitPrice
  const freeValue = free * unitPrice
  const fullValue = (paid + free) * unitPrice
  const lineDiscount = applyItemDiscount(payable, discountType, storageDiscountValue)
  const net = Math.max(0, payable - lineDiscount)

  // Report resolved pricing detail upward whenever it changes (live summary).
  useEffect(() => {
    onLineChange?.(index, {
      serviceName,
      paidQuantity: paid,
      freeQuantity: free,
      unitPrice,
      discountType,
      discountValue: storageDiscountValue,
    })
  }, [index, serviceName, paid, free, unitPrice, discountType, storageDiscountValue, onLineChange])

  return (
    <div className="rounded-lg border p-3 flex flex-col gap-3 bg-background">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {t("packages.items.itemNumber")} <span className="tabular-nums">{index + 1}</span>
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

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
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
        {/* Per-item discount type */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={discountTypePath as string}>{t("packages.items.discountType")}</Label>
          <Controller
            control={control}
            name={discountTypePath}
            render={({ field }) => (
              <Select
                value={(field.value as string) ?? DISCOUNT_NONE}
                onValueChange={(v) => {
                  if (v === DISCOUNT_NONE) {
                    field.onChange(null)
                    setValue(discountValuePath, 0 as never, { shouldDirty: true })
                  } else {
                    field.onChange(v)
                  }
                }}
              >
                <SelectTrigger id={discountTypePath as string}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={DISCOUNT_NONE}>{t("packages.items.discountNone")}</SelectItem>
                  <SelectItem value="PERCENTAGE">{t("packages.create.discountPercentage")}</SelectItem>
                  <SelectItem value="FIXED">{t("packages.create.discountFixed")}</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>
        {/* Per-item discount value */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={discountValuePath as string}>{t("packages.items.discountValue")}</Label>
          <Input
            id={discountValuePath as string}
            type="number"
            min={0}
            disabled={!discountType}
            className="tabular-nums"
            {...register(discountValuePath, { valueAsNumber: true })}
          />
        </div>
      </div>

      {selectedDuration && (
        <div className="flex flex-col gap-1 border-t pt-2 text-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span>
              {paid + free} × {formatPrice(unitPrice)}
            </span>
            <span className="tabular-nums">{formatPrice(fullValue)}</span>
          </div>
          {free > 0 && (
            <div className="flex items-center justify-between text-success">
              <span>
                {free} {t("packages.summary.free")}
              </span>
              <span className="tabular-nums">-{formatPrice(freeValue)}</span>
            </div>
          )}
          {lineDiscount > 0 && (
            <div className="flex items-center justify-between text-success">
              <span>{t("packages.summary.discount")}</span>
              <span className="tabular-nums">-{formatPrice(lineDiscount)}</span>
            </div>
          )}
          <div className="flex items-center justify-between border-t pt-1 font-semibold text-foreground">
            <span>{t("packages.items.lineNet")}</span>
            <span className="tabular-nums">{formatPrice(net)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
