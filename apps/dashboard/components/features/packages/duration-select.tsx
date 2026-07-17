"use client"

/**
 * DurationSelect — Sawaa Dashboard (packages feature)
 *
 * The single-duration dropdown shown only for single-specific items. Reuses the
 * selected practitioner's effective duration rows (id + delivery + mins +
 * price) and emits a scope (INCLUDE one id, or ANY when cleared).
 */

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
import type { ScopeFormData } from "@/lib/schemas/package.schema"

const NONE = "__none__"

export interface DurationChoice {
  id: string
  deliveryType: "IN_PERSON" | "ONLINE"
  durationMins: number
  price: number
}

interface Props {
  id: string
  selectedId: string | undefined
  choices: DurationChoice[]
  onChange: (scope: ScopeFormData) => void
  error?: string
}

export function DurationSelect({
  id,
  selectedId,
  choices,
  onChange,
  error,
}: Props) {
  const { t } = useLocale()
  const empty = choices.length === 0

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{t("packages.items.duration")}</Label>
      <Select
        value={selectedId || NONE}
        onValueChange={(v) =>
          onChange(
            v === NONE
              ? { mode: "ANY", ids: [] }
              : { mode: "INCLUDE", ids: [v] }
          )
        }
        disabled={empty}
      >
        <SelectTrigger id={id} aria-invalid={error ? "true" : undefined}>
          <SelectValue
            placeholder={
              empty
                ? t("packages.items.durationUnavailable")
                : t("packages.items.durationPlaceholder")
            }
          />
        </SelectTrigger>
        <SelectContent>
          {empty ? (
            <SelectItem value={NONE} disabled>
              {t("packages.items.durationUnavailable")}
            </SelectItem>
          ) : (
            choices.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {t(`packages.items.deliveryType.${d.deliveryType}`)} ·{" "}
                {d.durationMins} {t("common.min")} · {formatPrice(d.price)}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
