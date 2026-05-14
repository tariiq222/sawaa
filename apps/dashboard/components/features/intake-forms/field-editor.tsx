"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import {
  Delete02Icon,
  Add01Icon,
  ArrowUp01Icon,
  ArrowDown01Icon,
  InputShortTextIcon,
  InputLongTextIcon,
  RightToLeftListNumberIcon,
  RadioButtonIcon,
  CheckListIcon,
  Select01Icon,
  Calendar01Icon,
  StarIcon,
  FileUploadIcon,
} from "@hugeicons/core-free-icons"
import type { IconSvgElement } from "@hugeicons/react"
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
import { useLocale } from "@/components/locale-provider"
import type { FormField, FieldType } from "@/lib/types/intake-form"
import { FIELD_TYPE_LABELS } from "@/lib/types/intake-form"
import { FieldConditionEditor } from "@/components/features/intake-forms/field-condition-editor"

const FIELD_TYPES: FieldType[] = [
  "text", "textarea", "radio", "checkbox", "select", "number", "date", "rating", "file",
]

const FIELD_TYPE_ICONS: Record<FieldType, IconSvgElement> = {
  text: InputShortTextIcon,
  textarea: InputLongTextIcon,
  number: RightToLeftListNumberIcon,
  radio: RadioButtonIcon,
  checkbox: CheckListIcon,
  select: Select01Icon,
  date: Calendar01Icon,
  rating: StarIcon,
  file: FileUploadIcon,
}

const OPTIONS_FIELD_TYPES: FieldType[] = ["radio", "checkbox", "select"]

interface FieldEditorProps {
  field: FormField
  index: number
  totalFields: number
  prevFields: FormField[]
  onChange: (updated: FormField) => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}

export function FieldEditor({
  field,
  index,
  totalFields,
  prevFields,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: FieldEditorProps) {
  const { locale, t } = useLocale()
  const isAr = locale === "ar"

  function update(patch: Partial<FormField>) {
    onChange({ ...field, ...patch })
  }

  function addOption() {
    update({ options: [...field.options, ""] })
  }

  function updateOption(i: number, val: string) {
    const options = [...field.options]
    options[i] = val
    update({ options })
  }

  function removeOption(i: number) {
    update({ options: field.options.filter((_, idx) => idx !== i) })
  }

  const needsOptions = OPTIONS_FIELD_TYPES.includes(field.type)

  return (
    <div className="rounded-lg border border-border bg-card p-4 flex flex-col gap-4">
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-muted-foreground tabular-nums">
          {t("intakeForms.field.field")} {index + 1}
        </span>
        <div className="flex items-center gap-1 ms-auto">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            disabled={index === 0}
            onClick={onMoveUp}
            aria-label={t("intakeForms.field.moveUp")}
          >
            <HugeiconsIcon icon={ArrowUp01Icon} size={14} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            disabled={index === totalFields - 1}
            onClick={onMoveDown}
            aria-label={t("intakeForms.field.moveDown")}
          >
            <HugeiconsIcon icon={ArrowDown01Icon} size={14} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 text-destructive hover:text-destructive"
            onClick={onRemove}
            aria-label={t("intakeForms.field.remove")}
          >
            <HugeiconsIcon icon={Delete02Icon} size={14} />
          </Button>
        </div>
      </div>

      {/* Labels */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">{t("intakeForms.field.labelAr")}</Label>
          <Input
            value={field.labelAr}
            onChange={(e) => update({ labelAr: e.target.value })}
            placeholder={t("intakeForms.field.labelArPlaceholder")}
            dir="rtl"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">{t("intakeForms.field.labelEn")}</Label>
          <Input
            value={field.labelEn}
            onChange={(e) => update({ labelEn: e.target.value })}
            placeholder={t("intakeForms.field.labelEnPlaceholder")}
            dir="ltr"
          />
        </div>
      </div>

      {/* Type + Required */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">{t("intakeForms.field.type")}</Label>
          <Select
            value={field.type}
            onValueChange={(v) =>
              update({ type: v as FieldType, options: OPTIONS_FIELD_TYPES.includes(v as FieldType) ? field.options : [] })
            }
          >
            <SelectTrigger>
              <SelectValue>
                <span className="flex items-center gap-2">
                  <HugeiconsIcon icon={FIELD_TYPE_ICONS[field.type]} size={15} className="shrink-0 text-muted-foreground" />
                  {isAr ? FIELD_TYPE_LABELS[field.type].ar : FIELD_TYPE_LABELS[field.type].en}
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {FIELD_TYPES.map((ft) => (
                <SelectItem key={ft} value={ft}>
                  <span className="flex items-center gap-2">
                    <HugeiconsIcon icon={FIELD_TYPE_ICONS[ft]} size={15} className="shrink-0 text-muted-foreground" />
                    {isAr ? FIELD_TYPE_LABELS[ft].ar : FIELD_TYPE_LABELS[ft].en}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-3 pt-5">
          <Switch
            id={`required-${field.id}`}
            checked={field.required}
            onCheckedChange={(v) => update({ required: v })}
          />
          <Label htmlFor={`required-${field.id}`} className="text-sm cursor-pointer">
            {t("intakeForms.field.required")}
          </Label>
        </div>
      </div>

      {/* Options for radio/checkbox/select */}
      {needsOptions && (
        <div className="flex flex-col gap-2">
          <Label className="text-xs">{t("intakeForms.field.options")}</Label>
          {field.options.map((opt, i) => (
            <div key={`option-${i}`} className="flex items-center gap-2">
              <Input
                value={opt}
                onChange={(e) => updateOption(i, e.target.value)}
                placeholder={`${t("intakeForms.field.option")} ${i + 1}`}
                className="flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 shrink-0 text-destructive hover:text-destructive"
                onClick={() => removeOption(i)}
                disabled={field.options.length <= 1}
                aria-label={t("intakeForms.field.removeOption")}
              >
                <HugeiconsIcon icon={Delete02Icon} size={14} />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start gap-1.5"
            onClick={addOption}
          >
            <HugeiconsIcon icon={Add01Icon} size={14} />
            {t("intakeForms.field.addOption")}
          </Button>
        </div>
      )}

      {/* Conditional Logic */}
      {prevFields.length > 0 && (
        <FieldConditionEditor field={field} prevFields={prevFields} onUpdate={update} />
      )}
    </div>
  )
}
