"use client"

import { useState, useMemo } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Cancel01Icon } from "@hugeicons/core-free-icons"

import { Input } from "@sawaa/ui"
import { Badge } from "@sawaa/ui"
import { Checkbox } from "@sawaa/ui"
import { Label } from "@sawaa/ui"
import { useServices } from "@/hooks/use-services"
import { useLocale } from "@/components/locale-provider"

interface Props {
  value: string[]
  onChange: (ids: string[]) => void
}

export function BundleServicesPicker({ value, onChange }: Props) {
  const { t, locale } = useLocale()
  const [localSearch, setLocalSearch] = useState("")
  const { services, isLoading } = useServices()

  const filtered = useMemo(() => {
    const q = localSearch.trim().toLowerCase()
    if (!q) return services
    return services.filter((s) =>
      s.nameAr.toLowerCase().includes(q) ||
      (s.nameEn ?? "").toLowerCase().includes(q),
    )
  }, [services, localSearch])

  const selectedServices = useMemo(
    () => services.filter((s) => value.includes(s.id)),
    [services, value],
  )

  const toggle = (id: string) => {
    if (value.includes(id)) {
      onChange(value.filter((v) => v !== id))
    } else {
      onChange([...value, id])
    }
  }

  const remove = (id: string) => {
    onChange(value.filter((v) => v !== id))
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium text-foreground">{t("bundles.picker.title")}</p>

      <Input
        placeholder={t("bundles.picker.searchPlaceholder")}
        value={localSearch}
        onChange={(e) => setLocalSearch(e.target.value)}
      />

      <div className="max-h-48 overflow-y-auto rounded-md border p-2 flex flex-col gap-1">
        {isLoading && (
          <p className="text-xs text-muted-foreground py-2 text-center">{t("common.loading")}</p>
        )}
        {!isLoading && filtered.length === 0 && (
          <p className="text-xs text-muted-foreground py-2 text-center">{t("bundles.picker.empty")}</p>
        )}
        {filtered.map((s) => {
          const name = locale === "ar" ? s.nameAr : (s.nameEn ?? s.nameAr)
          const checked = value.includes(s.id)
          return (
            <div
              key={s.id}
              className="flex items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-muted cursor-pointer"
              onClick={() => toggle(s.id)}
            >
              <Checkbox
                id={`svc-${s.id}`}
                checked={checked}
                onCheckedChange={() => toggle(s.id)}
                onClick={(e) => e.stopPropagation()}
              />
              <Label
                htmlFor={`svc-${s.id}`}
                className="flex-1 cursor-pointer text-sm"
              >
                {name}
              </Label>
              <span className="tabular-nums text-xs text-muted-foreground">
                {s.price} {s.currency}
              </span>
            </div>
          )
        })}
      </div>

      {selectedServices.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <span className="text-xs text-muted-foreground self-center">
            {t("bundles.picker.selected")}:
          </span>
          {selectedServices.map((s) => {
            const name = locale === "ar" ? s.nameAr : (s.nameEn ?? s.nameAr)
            return (
              <Badge
                key={s.id}
                variant="secondary"
                className="gap-1 pe-1"
              >
                {name}
                <button
                  type="button"
                  onClick={() => remove(s.id)}
                  className="ms-0.5 rounded-sm hover:text-destructive"
                  aria-label={`Remove ${name}`}
                >
                  <HugeiconsIcon icon={Cancel01Icon} size={12} />
                </button>
              </Badge>
            )
          })}
        </div>
      )}
    </div>
  )
}
