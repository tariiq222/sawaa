"use client"

import { useEffect } from "react"
import { useForm, Controller, type Path } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@deqah/ui"
import { Input } from "@deqah/ui"
import { Label } from "@deqah/ui"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deqah/ui"
import { Textarea } from "@deqah/ui"
import {
  featureCardsSchema,
  type FeatureCardsSchema,
} from "@/lib/schemas/feature-cards.schema"
import {
  FEATURE_CARD_COUNT,
  FEATURE_CARD_DEFAULTS,
  FEATURE_CARD_FIELDS,
  FEATURE_CARD_ICON_OPTIONS,
  featureCardKey,
  type FeatureCardField,
  type FeatureCardIcon,
  type FeatureCardIndex,
  type FeatureCardsFormValues,
  type FeatureCardValues,
} from "@/lib/types/feature-cards"
import type { SiteSettingRow } from "@/lib/types/site-settings"
import { useUpsertSiteSettings } from "@/hooks/use-site-settings"
import { useLocale } from "@/components/locale-provider"

const CARD_INDICES: readonly FeatureCardIndex[] = [0, 1, 2]

function rowToText(row: SiteSettingRow | undefined, fallback: string): string {
  if (!row) return fallback
  return row.valueAr ?? row.valueText ?? row.valueEn ?? fallback
}

const VALID_ICONS = new Set<string>(FEATURE_CARD_ICON_OPTIONS)

function isIcon(value: string): value is FeatureCardIcon {
  return VALID_ICONS.has(value)
}

function rowToIcon(
  row: SiteSettingRow | undefined,
  fallback: FeatureCardIcon,
): FeatureCardIcon {
  const raw = row?.valueText ?? row?.valueAr ?? row?.valueEn
  return raw && isIcon(raw) ? raw : fallback
}

function buildInitialCard(
  map: Map<string, SiteSettingRow>,
  idx: FeatureCardIndex,
): FeatureCardValues {
  const defaults = FEATURE_CARD_DEFAULTS.cards[idx]
  return {
    label: rowToText(map.get(featureCardKey(idx, "label")), defaults.label),
    title: rowToText(map.get(featureCardKey(idx, "title")), defaults.title),
    desc:  rowToText(map.get(featureCardKey(idx, "desc")),  defaults.desc),
    icon:  rowToIcon(map.get(featureCardKey(idx, "icon")),  defaults.icon),
  }
}

function buildInitial(rows: SiteSettingRow[]): FeatureCardsFormValues {
  const map = new Map(rows.map((r) => [r.key, r]))
  return {
    cards: [
      buildInitialCard(map, 0),
      buildInitialCard(map, 1),
      buildInitialCard(map, 2),
    ],
  }
}

function buildEntries(values: FeatureCardsFormValues) {
  const entries: { key: string; valueAr?: string; valueText?: string }[] = []
  CARD_INDICES.forEach((idx) => {
    const card = values.cards[idx]
    FEATURE_CARD_FIELDS.forEach((field) => {
      const key = featureCardKey(idx, field)
      if (field === "icon") {
        entries.push({ key, valueText: card[field] })
      } else {
        entries.push({ key, valueAr: card[field] })
      }
    })
  })
  return entries
}

interface Props {
  rows: SiteSettingRow[]
}

export function FeatureCardsForm({ rows }: Props) {
  const { t } = useLocale()
  const mutation = useUpsertSiteSettings()
  const form = useForm<FeatureCardsSchema>({
    resolver: zodResolver(featureCardsSchema),
    defaultValues: FEATURE_CARD_DEFAULTS,
  })

  useEffect(() => {
    form.reset(buildInitial(rows))
  }, [rows, form])

  const onSubmit = (values: FeatureCardsSchema) => {
    mutation.mutate({ entries: buildEntries(values) })
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
      {CARD_INDICES.map((idx) => (
        <CardPanel key={idx} form={form} index={idx} t={t} />
      ))}

      <div className="flex justify-end gap-2 pt-4 border-t border-border">
        <Button
          type="button"
          variant="outline"
          onClick={() => form.reset(buildInitial(rows))}
        >
          {t("content.form.reset")}
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? t("content.form.saving") : t("content.form.save")}
        </Button>
      </div>
    </form>
  )
}

interface PanelProps {
  form: ReturnType<typeof useForm<FeatureCardsSchema>>
  index: FeatureCardIndex
  t: (key: string, vars?: Record<string, string | number>) => string
}

function CardPanel({ form, index, t }: PanelProps) {
  const errs = form.formState.errors.cards?.[index]

  return (
    <section className="rounded-lg border border-border p-5 space-y-4">
      <h3 className="text-sm font-semibold text-muted-foreground">
        {t("content.cards.cardHeading", { index: index + 1, total: FEATURE_CARD_COUNT })}
      </h3>
      <div className="grid gap-4 md:grid-cols-2">
        {FEATURE_CARD_FIELDS.map((field) => {
          const inputId = `card-${index}-${field}`
          const path = `cards.${index}.${field}` as Path<FeatureCardsSchema>
          const error = errs?.[field]?.message

          if (field === "icon") {
            const iconPath = `cards.${index}.icon` as const
            return (
              <div key={field} className="space-y-2">
                <Label htmlFor={inputId}>{t(`content.cards.field.${field}`)}</Label>
                <Controller
                  control={form.control}
                  name={iconPath}
                  render={({ field: ctl }) => (
                    <Select value={ctl.value} onValueChange={ctl.onChange}>
                      <SelectTrigger id={inputId}>
                        <SelectValue placeholder={t("content.cards.iconPlaceholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        {FEATURE_CARD_ICON_OPTIONS.map((name) => (
                          <SelectItem key={name} value={name}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {error ? (
                  <p className="text-xs text-destructive">{error}</p>
                ) : null}
              </div>
            )
          }

          const multiline = field === "desc"
          return (
            <div
              key={field}
              className={`space-y-2 ${multiline ? "md:col-span-2" : ""}`}
            >
              <Label htmlFor={inputId}>{t(`content.cards.field.${field}`)}</Label>
              {multiline ? (
                <Textarea id={inputId} rows={3} {...form.register(path)} />
              ) : (
                <Input id={inputId} {...form.register(path)} />
              )}
              {error ? (
                <p className="text-xs text-destructive">{error}</p>
              ) : null}
            </div>
          )
        })}
      </div>
    </section>
  )
}
