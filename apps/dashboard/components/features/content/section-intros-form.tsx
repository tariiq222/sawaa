"use client"

import { useEffect } from "react"
import { useForm, type Path } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@deqah/ui"
import { Input } from "@deqah/ui"
import { Label } from "@deqah/ui"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@deqah/ui"
import { Textarea } from "@deqah/ui"
import {
  sectionIntrosSchema,
  type SectionIntrosSchema,
} from "@/lib/schemas/section-intros.schema"
import {
  SECTION_INTRO_DEFAULTS,
  SECTION_INTRO_FIELDS,
  SECTION_INTRO_KEYS,
  sectionIntroKey,
  type SectionIntroKey,
  type SectionIntroValues,
  type SectionIntrosFormValues,
  type SiteSettingRow,
} from "@/lib/types/site-settings"
import { useUpsertSiteSettings } from "@/hooks/use-site-settings"
import { useLocale } from "@/components/locale-provider"


function rowToText(row: SiteSettingRow | undefined, fallback: string): string {
  if (!row) return fallback
  return row.valueAr ?? row.valueText ?? row.valueEn ?? fallback
}

function buildInitial(rows: SiteSettingRow[]): SectionIntrosFormValues {
  const map = new Map(rows.map((r) => [r.key, r]))
  const next = {} as SectionIntrosFormValues
  SECTION_INTRO_KEYS.forEach((section) => {
    const defaults = SECTION_INTRO_DEFAULTS[section]
    next[section] = SECTION_INTRO_FIELDS.reduce((acc, field) => {
      const key = sectionIntroKey(section, field)
      acc[field] = rowToText(map.get(key), defaults[field])
      return acc
    }, {} as SectionIntroValues)
  })
  return next
}

function buildEntries(values: SectionIntrosFormValues) {
  const entries: { key: string; valueAr: string }[] = []
  SECTION_INTRO_KEYS.forEach((section) => {
    SECTION_INTRO_FIELDS.forEach((field) => {
      entries.push({
        key: sectionIntroKey(section, field),
        valueAr: values[section][field],
      })
    })
  })
  return entries
}

interface Props {
  rows: SiteSettingRow[]
}

export function SectionIntrosForm({ rows }: Props) {
  const { t } = useLocale()
  const mutation = useUpsertSiteSettings()
  const form = useForm<SectionIntrosSchema>({
    resolver: zodResolver(sectionIntrosSchema),
    defaultValues: SECTION_INTRO_DEFAULTS,
  })

  useEffect(() => {
    form.reset(buildInitial(rows))
  }, [rows, form])

  const onSubmit = (values: SectionIntrosSchema) => {
    mutation.mutate({ entries: buildEntries(values) })
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <Tabs defaultValue="features">
        <TabsList>
          {SECTION_INTRO_KEYS.map((section) => (
            <TabsTrigger key={section} value={section}>
              {t(`content.intros.section.${section}`)}
            </TabsTrigger>
          ))}
        </TabsList>

        {SECTION_INTRO_KEYS.map((section) => (
          <TabsContent key={section} value={section} className="pt-4">
            <SectionPanel form={form} section={section} t={t} />
          </TabsContent>
        ))}
      </Tabs>

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
  form: ReturnType<typeof useForm<SectionIntrosSchema>>
  section: SectionIntroKey
  t: (key: string) => string
}

function SectionPanel({ form, section, t }: PanelProps) {
  const errs = form.formState.errors[section]
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {SECTION_INTRO_FIELDS.map((field) => {
        const path = `${section}.${field}` as Path<SectionIntrosSchema>
        const inputId = `${section}-${field}`
        const error = errs?.[field]?.message
        const multiline = field === "subtitle"
        return (
          <div key={field} className="space-y-2">
            <Label htmlFor={inputId}>{t(`content.intros.field.${field}`)}</Label>
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
  )
}
