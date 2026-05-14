"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { StarIcon, UploadSquare01Icon } from "@hugeicons/core-free-icons"
import { Input } from "@deqah/ui"
import { Label } from "@deqah/ui"
import { Textarea } from "@deqah/ui"
import { Checkbox } from "@deqah/ui"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deqah/ui"
import { cn } from "@/lib/utils"
import { useLocale } from "@/components/locale-provider"
import type { FieldType } from "@/lib/types/intake-form"

/* ─── Field Preview Wrapper ─── */

export function FieldPreview({
  field,
  isAr,
  value,
  onChange,
  onToggleCheckbox,
}: {
  field: { id: string; labelEn: string; labelAr: string; type: FieldType; required: boolean; options: string[] }
  isAr: boolean
  value: string | string[] | undefined
  onChange: (v: string) => void
  onToggleCheckbox: (opt: string) => void
}) {
  const label = isAr ? field.labelAr || field.labelEn : field.labelEn || field.labelAr

  return (
    <div className="flex flex-col gap-2">
      <Label className="text-sm font-medium text-foreground">
        {label}
        {field.required && <span className="ms-1 text-destructive">*</span>}
      </Label>
      <FieldInput
        type={field.type}
        options={field.options}
        value={value}
        isAr={isAr}
        onChange={onChange}
        onToggleCheckbox={onToggleCheckbox}
      />
    </div>
  )
}

/* ─── Field Input by Type ─── */

export function FieldInput({
  type,
  options,
  value,
  isAr: _isAr,
  onChange,
  onToggleCheckbox,
}: {
  type: FieldType
  options: string[]
  value: string | string[] | undefined
  isAr: boolean
  onChange: (v: string) => void
  onToggleCheckbox: (opt: string) => void
}) {
  const { t } = useLocale()

  if (type === "text" || type === "number" || type === "date") {
    return (
      <Input
        type={type === "number" ? "number" : type === "date" ? "date" : "text"}
        value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="tabular-nums"
      />
    )
  }

  if (type === "textarea") {
    return (
      <Textarea
        value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
      />
    )
  }

  if (type === "radio") {
    return (
      <div className="flex flex-col gap-2">
        {options.map((opt) => (
          <label key={opt} className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="radio"
              name={`radio-${opt}`}
              checked={value === opt}
              onChange={() => onChange(opt)}
              className="accent-primary"
            />
            <span className="text-sm text-foreground">{opt}</span>
          </label>
        ))}
      </div>
    )
  }

  if (type === "checkbox") {
    const checked = (value as string[]) ?? []
    return (
      <div className="flex flex-col gap-2">
        {options.map((opt) => (
          <div key={opt} className="flex items-center gap-2.5">
            <Checkbox
              id={`chk-${opt}`}
              checked={checked.includes(opt)}
              onCheckedChange={() => onToggleCheckbox(opt)}
            />
            <Label htmlFor={`chk-${opt}`} className="cursor-pointer font-normal">
              {opt}
            </Label>
          </div>
        ))}
      </div>
    )
  }

  if (type === "select") {
    return (
      <Select value={(value as string) ?? ""} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder={t("intakeForms.input.selectPlaceholder")} />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  if (type === "rating") {
    const rating = Number(value ?? 0)
    return (
      <div className="flex items-center gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <button
            key={`rating-star-${i}`}
            type="button"
            onClick={() => onChange(String(i + 1))}
            className="focus:outline-none"
          >
            <HugeiconsIcon
              icon={StarIcon}
              size={24}
              className={cn(
                "transition-colors",
                i < rating ? "text-warning" : "text-muted-foreground/30"
              )}
            />
          </button>
        ))}
        {rating > 0 && (
          <span className="ms-2 text-xs tabular-nums text-muted-foreground">{rating}/5</span>
        )}
      </div>
    )
  }

  if (type === "file") {
    return (
      <div className="flex items-center justify-center rounded-lg border-2 border-dashed border-border p-6 text-center">
        <div className="flex flex-col items-center gap-2">
          <HugeiconsIcon icon={UploadSquare01Icon} size={24} className="text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            {t("intakeForms.input.fileUpload")}
          </p>
        </div>
      </div>
    )
  }

  return null
}
