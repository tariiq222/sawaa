"use client"

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@deqah/ui"
import { Input } from "@deqah/ui"
import { Label } from "@deqah/ui"
import { Textarea } from "@deqah/ui"
import { heroFormSchema, type HeroFormSchema } from "@/lib/schemas/hero.schema"
import {
  HERO_DEFAULTS,
  HERO_KEY_MAP,
  type HeroFormValues,
  type SiteSettingRow,
} from "@/lib/types/site-settings"
import { useUpsertSiteSettings } from "@/hooks/use-site-settings"
import { useLocale } from "@/components/locale-provider"
import type { FieldErrors, UseFormRegister } from "react-hook-form"

function rowToText(row: SiteSettingRow | undefined, fallback: string): string {
  if (!row) return fallback
  return row.valueAr ?? row.valueText ?? row.valueEn ?? fallback
}

function rowToMedia(row: SiteSettingRow | undefined, fallback: string): string {
  return row?.valueMedia ?? fallback
}

function buildInitial(rows: SiteSettingRow[]): HeroFormValues {
  const map = new Map(rows.map((r) => [r.key, r]))
  const next: HeroFormValues = { ...HERO_DEFAULTS }
  ;(Object.keys(HERO_KEY_MAP) as (keyof HeroFormValues)[]).forEach((field) => {
    const key = HERO_KEY_MAP[field]
    const row = map.get(key)
    if (field === "heroImageUrl") {
      next[field] = rowToMedia(row, HERO_DEFAULTS[field])
    } else {
      next[field] = rowToText(row, HERO_DEFAULTS[field])
    }
  })
  return next
}

interface FieldProps {
  label: string
  field: keyof HeroFormValues
  multiline?: boolean
  register: UseFormRegister<HeroFormSchema>
  errors: FieldErrors<HeroFormSchema>
}

function Field({ label, field, multiline, register, errors }: FieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={field}>{label}</Label>
      {multiline ? (
        <Textarea id={field} rows={3} {...register(field)} />
      ) : (
        <Input id={field} {...register(field)} />
      )}
      {errors[field] ? (
        <p className="text-xs text-destructive">{errors[field]?.message}</p>
      ) : null}
    </div>
  )
}

interface Props {
  rows: SiteSettingRow[]
}

export function HeroForm({ rows }: Props) {
  const mutation = useUpsertSiteSettings()
  const form = useForm<HeroFormSchema>({
    resolver: zodResolver(heroFormSchema),
    defaultValues: HERO_DEFAULTS,
  })

  useEffect(() => {
    form.reset(buildInitial(rows))
  }, [rows, form])

  const onSubmit = (values: HeroFormSchema) => {
    const entries = (Object.keys(HERO_KEY_MAP) as (keyof HeroFormValues)[]).map(
      (field) => {
        const key = HERO_KEY_MAP[field]
        if (field === "heroImageUrl") {
          return { key, valueMedia: values[field] }
        }
        if (field === "ctaPrimaryHref" || field === "ctaSecondaryHref") {
          return { key, valueText: values[field] }
        }
        return { key, valueAr: values[field] }
      },
    )
    mutation.mutate({ entries })
  }

  const { t } = useLocale()
  const reg = form.register
  const errs = form.formState.errors

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
      <section className="grid gap-6 md:grid-cols-2">
        <Field label={t("content.hero.badgeText")} field="badgeText" register={reg} errors={errs} />
        <Field label={t("content.hero.subtitle")} field="subtitle" multiline register={reg} errors={errs} />
        <Field label={t("content.hero.titlePrefix")} field="titlePrefix" register={reg} errors={errs} />
        <Field label={t("content.hero.titleHighlight")} field="titleHighlight" register={reg} errors={errs} />
        <Field label={t("content.hero.titleSuffix")} field="titleSuffix" register={reg} errors={errs} />
        <Field label={t("content.hero.heroImageUrl")} field="heroImageUrl" register={reg} errors={errs} />
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <Field label={t("content.hero.ctaPrimaryText")} field="ctaPrimaryText" register={reg} errors={errs} />
        <Field label={t("content.hero.ctaPrimaryHref")} field="ctaPrimaryHref" register={reg} errors={errs} />
        <Field label={t("content.hero.ctaSecondaryText")} field="ctaSecondaryText" register={reg} errors={errs} />
        <Field label={t("content.hero.ctaSecondaryHref")} field="ctaSecondaryHref" register={reg} errors={errs} />
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <Field label={t("content.hero.badgeFloatTopLabel")} field="badgeFloatTopLabel" register={reg} errors={errs} />
        <Field label={t("content.hero.badgeFloatTopValue")} field="badgeFloatTopValue" register={reg} errors={errs} />
        <Field label={t("content.hero.badgeFloatBottomLabel")} field="badgeFloatBottomLabel" register={reg} errors={errs} />
        <Field label={t("content.hero.badgeFloatBottomValue")} field="badgeFloatBottomValue" register={reg} errors={errs} />
      </section>

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