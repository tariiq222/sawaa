"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, Delete02Icon } from "@hugeicons/core-free-icons"

import { Button } from "@deqah/ui"
import { Input } from "@deqah/ui"
import { Label } from "@deqah/ui"
import { Switch } from "@deqah/ui"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deqah/ui"
import { useIntakeFormMutations } from "@/hooks/use-services"
import { useLocale } from "@/components/locale-provider"
import type { IntakeFieldApi } from "@/lib/types/intake-form-api"
import type { FieldType } from "@/lib/types/intake-form-shared"

const FIELD_TYPES = [
  { value: "text", labelKey: "services.fields.type.text" },
  { value: "textarea", labelKey: "services.fields.type.textarea" },
  { value: "number", labelKey: "services.fields.type.number" },
  { value: "select", labelKey: "services.fields.type.select" },
  { value: "checkbox", labelKey: "services.fields.type.checkbox" },
  { value: "date", labelKey: "services.fields.type.date" },
  { value: "time", labelKey: "services.fields.type.time" },
  { value: "static_text", labelKey: "services.fields.type.staticText" },
] as const

interface DraftField {
  key: string
  labelEn: string
  labelAr: string
  fieldType: string
  options: string
  isRequired: boolean
  sortOrder: number
}

interface Props {
  formId: string
  serviceId: string
  initialFields: IntakeFieldApi[]
}

let keyCounter = 0
function nextKey() {
  return `field-${++keyCounter}`
}

export function IntakeFieldsEditor({ formId, serviceId, initialFields }: Props) {
  const { t } = useLocale()
  const [fields, setFields] = useState<DraftField[]>([])
  const [dirty, setDirty] = useState(false)
  const { setFieldsMut } = useIntakeFormMutations(serviceId)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFields(
      initialFields.map((f) => ({
        key: f.id,
        labelEn: f.labelEn ?? "",
        labelAr: f.labelAr,
        fieldType: f.fieldType,
        options: f.options?.join(", ") ?? "",
        isRequired: f.isRequired,
        sortOrder: f.sortOrder,
      })),
    )
    setDirty(false)
  }, [initialFields])

  const addField = () => {
    setFields((prev) => [
      ...prev,
      {
        key: nextKey(),
        labelEn: "",
        labelAr: "",
        fieldType: "text",
        options: "",
        isRequired: false,
        sortOrder: prev.length,
      },
    ])
    setDirty(true)
  }

  const removeField = (key: string) => {
    setFields((prev) => prev.filter((f) => f.key !== key))
    setDirty(true)
  }

  const updateField = (key: string, field: keyof DraftField, value: unknown) => {
    setFields((prev) =>
      prev.map((f) => (f.key === key ? { ...f, [field]: value } : f)),
    )
    setDirty(true)
  }

  const handleSave = async () => {
    try {
      await setFieldsMut.mutateAsync({
        formId,
        payload: {
          fields: fields.map((f, i) => ({
            labelEn: f.labelEn,
            labelAr: f.labelAr,
            fieldType: f.fieldType as FieldType,
            options: f.fieldType === "select" && f.options.trim()
              ? f.options.split(",").map((o) => o.trim()).filter(Boolean)
              : undefined,
            isRequired: f.isRequired,
            sortOrder: i,
          })),
        },
      })
      setDirty(false)
      toast.success(t("services.fields.saved"))
    } catch {
      toast.error(t("services.fields.saveFailed"))
    }
  }

  return (
    <div className="space-y-3 pt-2 border-t border-border mt-2">
      <p className="text-xs font-medium text-muted-foreground">
        {t("services.fields.title")}
      </p>

      {fields.map((field) => (
        <FieldRow
          key={field.key}
          field={field}
          t={t}
          onUpdate={(k, v) => updateField(field.key, k, v)}
          onRemove={() => removeField(field.key)}
        />
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full"
        onClick={addField}
      >
        <HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="size-4 me-1" />
        {t("services.fields.addField")}
      </Button>

      {dirty && (
        <Button
          type="button"
          size="sm"
          className="w-full"
          disabled={setFieldsMut.isPending}
          onClick={handleSave}
        >
          {setFieldsMut.isPending
            ? t("services.fields.saving")
            : t("services.fields.save")}
        </Button>
      )}
    </div>
  )
}

/* ─── Single Field Row ─── */

function FieldRow({
  field,
  t,
  onUpdate,
  onRemove,
}: {
  field: DraftField
  t: (key: string) => string
  onUpdate: (key: keyof DraftField, value: unknown) => void
  onRemove: () => void
}) {
  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <Label className="text-xs">{t("services.fields.labelEn")}</Label>
          <Input
            value={field.labelEn}
            onChange={(e) => onUpdate("labelEn", e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">{t("services.fields.labelAr")}</Label>
          <Input
            value={field.labelAr}
            onChange={(e) => onUpdate("labelAr", e.target.value)}
            className="h-8 text-sm"
            dir="rtl"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-xs">{t("services.fields.fieldType")}</Label>
        <Select
          value={field.fieldType}
          onValueChange={(v) => onUpdate("fieldType", v)}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FIELD_TYPES.map((ft) => (
              <SelectItem key={ft.value} value={ft.value}>
                {t(ft.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {field.fieldType === "select" && (
        <div className="flex flex-col gap-1">
          <Label className="text-xs">
            {t("services.fields.options")}
          </Label>
          <Input
            value={field.options}
            onChange={(e) => onUpdate("options", e.target.value)}
            placeholder={t("services.fields.optionsPlaceholder")}
            className="h-8 text-sm"
          />
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Switch
            checked={field.isRequired}
            onCheckedChange={(v) => onUpdate("isRequired", v)}
          />
          <Label className="text-xs cursor-pointer">
            {t("services.fields.required")}
          </Label>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-destructive hover:text-destructive"
          onClick={onRemove}
        >
          <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-4" />
        </Button>
      </div>
    </div>
  )
}
