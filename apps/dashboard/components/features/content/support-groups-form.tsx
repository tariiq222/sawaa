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

import { supportGroupsSchema, type SupportGroupsSchema } from "@/lib/schemas/support-groups.schema"
import {
  SUPPORT_GROUP_DEFAULTS,
  SUPPORT_GROUPS_KEY,
  type SiteSettingRow,
  type SupportGroupItem,
} from "@/lib/types/site-settings"
import { useUpsertSiteSettings } from "@/hooks/use-site-settings"
import { useLocale } from "@/components/locale-provider"

function buildInitial(rows: SiteSettingRow[]): SupportGroupItem[] {
  const row = rows.find((r) => r.key === SUPPORT_GROUPS_KEY)
  if (row?.valueJson && Array.isArray(row.valueJson)) {
    return row.valueJson as SupportGroupItem[]
  }
  return SUPPORT_GROUP_DEFAULTS
}

function buildEntry(groups: SupportGroupItem[]) {
  return { key: SUPPORT_GROUPS_KEY, valueJson: groups }
}

interface Props {
  rows: SiteSettingRow[]
}

export function SupportGroupsForm({ rows }: Props) {
  const { t } = useLocale()
  const mutation = useUpsertSiteSettings()
  const form = useForm<SupportGroupsSchema>({
    resolver: zodResolver(supportGroupsSchema),
    defaultValues: { groups: SUPPORT_GROUP_DEFAULTS },
  })
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "groups",
  })

  useEffect(() => {
    form.reset({ groups: buildInitial(rows) })
  }, [rows, form])

  const onSubmit = (values: SupportGroupsSchema) => {
    mutation.mutate({ entries: [buildEntry(values.groups)] })
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
                {t("content.supportGroups.groupHeading").replace("{index}", String(index + 1))}
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
                <Label>{t("content.supportGroups.name")}</Label>
                <Input {...form.register(`groups.${index}.name`)} />
              </div>
              <div className="space-y-2">
                <Label>{t("content.supportGroups.nameEn")}</Label>
                <Input {...form.register(`groups.${index}.nameEn`)} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>{t("content.supportGroups.desc")}</Label>
                <Textarea rows={2} {...form.register(`groups.${index}.desc`)} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>{t("content.supportGroups.descEn")}</Label>
                <Textarea rows={2} {...form.register(`groups.${index}.descEn`)} />
              </div>
              <div className="space-y-2">
                <Label>{t("content.supportGroups.image")}</Label>
                <Input {...form.register(`groups.${index}.image`)} />
              </div>
              <div className="space-y-2">
                <Label>{t("content.supportGroups.slug")}</Label>
                <Input {...form.register(`groups.${index}.slug`)} />
              </div>
              <div className="space-y-2">
                <Label>{t("content.supportGroups.participants")}</Label>
                <Input {...form.register(`groups.${index}.participants`)} />
              </div>
              <div className="space-y-2">
                <Label>{t("content.supportGroups.sessions")}</Label>
                <Input {...form.register(`groups.${index}.sessions`)} />
              </div>
              <div className="space-y-2">
                <Label>{t("content.supportGroups.format")}</Label>
                <Input {...form.register(`groups.${index}.format`)} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={() =>
          append({
            slug: "",
            name: "",
            nameEn: "",
            desc: "",
            descEn: "",
            image: "",
            participants: "",
            sessions: "",
            format: "",
          })
        }
      >
        <HugeiconsIcon icon={Add01Icon} className="w-4 h-4 me-2" />
        {t("content.supportGroups.addGroup")}
      </Button>

      <div className="flex justify-end gap-2 pt-4 border-t border-border">
        <Button
          type="button"
          variant="outline"
          onClick={() => form.reset({ groups: buildInitial(rows) })}
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
