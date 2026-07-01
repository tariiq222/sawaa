"use client"

/**
 * Package item fields — Sawaa Dashboard (packages feature)
 *
 * The quantities + price + discount inputs and the per-line price breakdown for
 * one item row. Presentational: RHF paths + computed money values come in as
 * props; the parent row owns the scope watches and pricing math.
 */

import { Controller, useFormContext } from "react-hook-form"

import { Input } from "@sawaa/ui"
import { Label } from "@sawaa/ui"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@sawaa/ui"

import { useLocale } from "@/components/locale-provider"
import { formatPrice } from "@/lib/money"
import type { PackageDiscountType } from "@/lib/types/package"

const DISCOUNT_NONE = "__no_discount__"

export interface ItemFieldsPaths {
  unitPrice: string
  paid: string
  free: string
  discountType: string
  discountValue: string
}

export interface ItemFieldsMoney {
  singleSpecific: boolean
  hasDerivedPrice: boolean
  unitPrice: number
  paid: number
  free: number
  fullValue: number
  freeValue: number
  lineDiscount: number
  net: number
  payable: number
  discountType: PackageDiscountType | null
}

interface Props {
  paths: ItemFieldsPaths
  money: ItemFieldsMoney
  unitPriceError?: string
}

export function PackageItemFields({ paths, money, unitPriceError }: Props) {
  const { t } = useLocale()
  const { control, register, setValue } = useFormContext()

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={paths.paid}>{t("packages.items.paidQuantity")}</Label>
          <Input
            id={paths.paid}
            type="number"
            min={0}
            className="tabular-nums"
            onFocus={(e) => e.currentTarget.select()}
            {...register(paths.paid, { valueAsNumber: true })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={paths.free}>{t("packages.items.freeQuantity")}</Label>
          <Input
            id={paths.free}
            type="number"
            min={0}
            className="tabular-nums"
            onFocus={(e) => e.currentTarget.select()}
            {...register(paths.free, { valueAsNumber: true })}
          />
        </div>

        {money.singleSpecific ? (
          <div className="flex flex-col gap-1.5">
            <Label>{t("packages.items.unitPrice")}</Label>
            <div className="flex h-9 items-center rounded-md border border-border bg-surface-muted px-3 text-sm tabular-nums text-muted-foreground">
              {money.hasDerivedPrice ? formatPrice(money.unitPrice) : t("packages.items.derivedPrice")}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={paths.unitPrice}>{t("packages.items.unitPrice")}</Label>
            <Input
              id={paths.unitPrice}
              type="number"
              min={0}
              step="0.01"
              className="tabular-nums"
              placeholder={t("packages.items.unitPricePlaceholder")}
              onFocus={(e) => e.currentTarget.select()}
              {...register(paths.unitPrice, { valueAsNumber: true })}
            />
            {unitPriceError && <p className="text-xs text-destructive">{unitPriceError}</p>}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={paths.discountType}>{t("packages.items.discountType")}</Label>
          <Controller
            control={control}
            name={paths.discountType}
            render={({ field }) => (
              <Select
                value={(field.value as string) ?? DISCOUNT_NONE}
                onValueChange={(v) => {
                  if (v === DISCOUNT_NONE) {
                    field.onChange(null)
                    setValue(paths.discountValue, 0 as never, { shouldDirty: true })
                  } else {
                    field.onChange(v)
                  }
                }}
              >
                <SelectTrigger id={paths.discountType}>
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
      </div>

      {money.discountType && (
        <div className="flex flex-col gap-1.5 md:max-w-[12rem]">
          <Label htmlFor={paths.discountValue}>{t("packages.items.discountValue")}</Label>
          <Input
            id={paths.discountValue}
            type="number"
            min={0}
            className="tabular-nums"
            onFocus={(e) => e.currentTarget.select()}
            {...register(paths.discountValue, { valueAsNumber: true })}
          />
        </div>
      )}

      {money.payable > 0 && (
        <div className="flex flex-col gap-1 border-t border-border pt-2 text-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span>
              {money.paid + money.free} × {formatPrice(money.unitPrice)}
            </span>
            <span className="tabular-nums">{formatPrice(money.fullValue)}</span>
          </div>
          {money.free > 0 && (
            <div className="flex items-center justify-between text-success">
              <span>
                {money.free} {t("packages.summary.free")}
              </span>
              <span className="tabular-nums">-{formatPrice(money.freeValue)}</span>
            </div>
          )}
          {money.lineDiscount > 0 && (
            <div className="flex items-center justify-between text-success">
              <span>{t("packages.summary.discount")}</span>
              <span className="tabular-nums">-{formatPrice(money.lineDiscount)}</span>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-border pt-1 font-semibold text-foreground">
            <span>{t("packages.items.lineNet")}</span>
            <span className="tabular-nums">{formatPrice(money.net)}</span>
          </div>
        </div>
      )}
    </>
  )
}
