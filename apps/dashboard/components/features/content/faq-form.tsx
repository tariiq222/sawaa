"use client"

import { useEffect } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@sawaa/ui"
import { Input } from "@sawaa/ui"
import { Label } from "@sawaa/ui"
import { Textarea } from "@sawaa/ui"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, Delete02Icon } from "@hugeicons/core-free-icons"

import { faqItemsSchema, type FaqItemsSchema } from "@/lib/schemas/faq.schema"
import {
  FAQ_DEFAULTS,
  FAQ_ITEMS_KEY,
  type SiteSettingRow,
  type FaqItem,
} from "@/lib/types/site-settings"
import { useUpsertSiteSettings } from "@/hooks/use-site-settings"
import { useLocale } from "@/components/locale-provider"

function buildInitial(rows: SiteSettingRow[]): FaqItem[] {
  const row = rows.find((r) => r.key === FAQ_ITEMS_KEY)
  if (row?.valueJson && Array.isArray(row.valueJson)) {
    return row.valueJson as FaqItem[]
  }
  return FAQ_DEFAULTS
}

function buildEntry(items: FaqItem[]) {
  return { key: FAQ_ITEMS_KEY, valueJson: items }
}

interface Props {
  rows: SiteSettingRow[]
}

export function FaqForm({ rows }: Props) {
  const { t } = useLocale()
  const mutation = useUpsertSiteSettings()
  const form = useForm<FaqItemsSchema>({
    resolver: zodResolver(faqItemsSchema),
    defaultValues: { items: FAQ_DEFAULTS },
  })
  const { fields, append, remove, move } = useFieldArray({
    control: form.control,
    name: "items",
  })

  useEffect(() => {
    form.reset({ items: buildInitial(rows) })
  }, [rows, form])

  const onSubmit = (values: FaqItemsSchema) => {
    mutation.mutate({ entries: [buildEntry(values.items)] })
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <div className="flex flex-col gap-4">
        {fields.map((field, index) => (
          <div
            key={field.id}
            className="rounded-lg border border-border p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-muted-foreground">
                {t("content.faq.itemHeading").replace("{index}", String(index + 1))}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => remove(index)}
                className="text-destructive"
              >
                <HugeiconsIcon icon={Delete02Icon} className="w-4 h-4" />
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("content.faq.q")}</Label>
                <Input {...form.register(`items.${index}.q`)} />
              </div>
              <div className="space-y-2">
                <Label>{t("content.faq.qEn")}</Label>
                <Input {...form.register(`items.${index}.qEn`)} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>{t("content.faq.a")}</Label>
                <Textarea rows={3} {...form.register(`items.${index}.a`)} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>{t("content.faq.aEn")}</Label>
                <Textarea rows={3} {...form.register(`items.${index}.aEn`)} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={() => append({ q: "", qEn: "", a: "", aEn: "" })}
      >
        <HugeiconsIcon icon={Add01Icon} className="w-4 h-4 me-2" />
        {t("content.faq.addItem")}
      </Button>

      <div className="flex justify-end gap-2 pt-4 border-t border-border">
        <Button
          type="button"
          variant="outline"
          onClick={() => form.reset({ items: buildInitial(rows) })}
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
