"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { Button, Input, Label, Switch, Textarea } from "@sawaa/ui"
import { useLocale } from "@/components/locale-provider"
import { PackageFamilyImageField } from "./package-family-image-field"
import { GroupedPackageGroups } from "./grouped-package-groups"
import { GroupedPackagePricing } from "./grouped-package-pricing"
import {
  copyFamilyOption,
  emptyFamilyOption,
  familyFormHasOptions,
  familyOptionFromForm,
  familyOptionPreview,
  familyOptionSessionCount,
  familyOptionToForm,
  type PackageFamilyEditorValue,
} from "@/lib/package-family-form"
import type { PackageFamilyOptionInput } from "@sawaa/shared/types"
import { groupedPackageInputSchema } from "@sawaa/shared/schemas"
import type { GroupedPackageFormData } from "@/lib/schemas/package-groups.schema"

export type { PackageFamilyEditorValue }

interface Props {
  initialValue: PackageFamilyEditorValue
  onSubmit: (value: PackageFamilyEditorValue) => void | Promise<void>
  onCancel: () => void
  onChange?: (value: PackageFamilyEditorValue) => void
}

export function PackageFamilyEditor({ initialValue, onSubmit, onCancel, onChange }: Props) {
  const { t } = useLocale()
  const [value, setValue] = useState(initialValue)
  // Upload completion must merge with edits made since the request began.
  const currentDraft = useRef(initialValue)
  const [optionError, setOptionError] = useState<"required" | "invalid" | null>(null)
  const [familyError, setFamilyError] = useState<"nameRequired" | null>(null)
  const submitting = useRef(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const update = (next: PackageFamilyEditorValue) => {
    currentDraft.current = next
    setValue(next)
    onChange?.(next)
  }

  const updateOption = (index: number, next: PackageFamilyOptionInput) => {
    update({ ...value, options: value.options.map((option, optionIndex) => optionIndex === index ? next : option) })
  }

  const addOption = () => update({ ...value, options: [...value.options, emptyFamilyOption()] })
  const copyOption = (index: number) => update({ ...value, options: [...value.options, copyFamilyOption(value.options[index])] })
  const removeOption = (index: number) => update({ ...value, options: value.options.filter((_, optionIndex) => optionIndex !== index) })
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitting.current || isUploading) return
    if (!value.nameAr.trim()) {
      setFamilyError("nameRequired")
      return
    }
    setFamilyError(null)
    if (!familyFormHasOptions(value)) {
      setOptionError("required")
      return
    }
    if (value.options.some((option) => !option.nameAr.trim() || !groupedPackageInputSchema.safeParse({ modelVersion: "GROUPED_V2", groups: option.groups, globalDiscount: option.globalDiscount }).success)) {
      setOptionError("invalid")
      return
    }
    setOptionError(null)
    submitting.current = true
    setIsSubmitting(true)
    try {
      await onSubmit(value)
    } finally {
      submitting.current = false
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6 pb-24">
      <fieldset disabled={isSubmitting} className="contents">
      <section className="rounded-2xl border border-border bg-surface-solid p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">{t("packages.family.details.title")}</h2>
            <p className="text-sm text-muted-foreground">{t("packages.family.details.description")}</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm"><Switch checked={value.isActive ?? true} onCheckedChange={(checked) => update({ ...value, isActive: checked })} />{t("packages.edit.isActive")}</label>
            <label className="flex items-center gap-2 text-sm"><Switch checked={value.isPublic ?? true} onCheckedChange={(checked) => update({ ...value, isPublic: checked })} />{t("packages.edit.isPublic")}</label>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t("packages.create.nameAr")} htmlFor="family-nameAr"><Input id="family-nameAr" value={value.nameAr} onChange={(event) => update({ ...value, nameAr: event.target.value })} dir="rtl" /></Field>
          <Field label={t("packages.create.nameEn")} htmlFor="family-nameEn"><Input id="family-nameEn" value={value.nameEn ?? ""} onChange={(event) => update({ ...value, nameEn: event.target.value })} dir="ltr" /></Field>
          <Field label={t("packages.create.descriptionAr")} htmlFor="family-descriptionAr"><Textarea id="family-descriptionAr" value={value.descriptionAr ?? ""} onChange={(event) => update({ ...value, descriptionAr: event.target.value })} dir="rtl" rows={3} /></Field>
          <Field label={t("packages.create.descriptionEn")} htmlFor="family-descriptionEn"><Textarea id="family-descriptionEn" value={value.descriptionEn ?? ""} onChange={(event) => update({ ...value, descriptionEn: event.target.value })} dir="ltr" rows={3} /></Field>
          <Field label={t("packages.create.sortOrder")} htmlFor="family-sortOrder"><Input id="family-sortOrder" type="number" min={0} value={value.sortOrder ?? 0} onChange={(event) => update({ ...value, sortOrder: Number(event.target.value) || 0 })} /></Field>
          <PackageFamilyImageField value={value.imageUrl} busy={isUploading} onBusyChange={setIsUploading} onChange={(imageUrl) => update({ ...currentDraft.current, imageUrl })} />
        </div>
        {familyError && <p role="alert" className="mt-3 text-sm text-destructive">{t("packages.family.errors.nameRequired")}</p>}
      </section>

      <section className="flex flex-col gap-4" aria-label={t("packages.family.options.title")}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="text-lg font-semibold">{t("packages.family.options.title")}</h2><p className="text-sm text-muted-foreground">{t("packages.family.options.description")}</p></div>
          <Button type="button" variant="outline" onClick={addOption}>{t("packages.family.options.add")}</Button>
        </div>
        {optionError && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{t(optionError === "required" ? "packages.family.errors.optionRequired" : "packages.family.errors.optionInvalid")}</p>}
        {value.options.map((option, index) => <FamilyOptionEditor key={`${option.id ?? "new"}-${index}`} option={option} index={index} onChange={(next) => updateOption(index, next)} onCopy={() => copyOption(index)} onRemove={() => removeOption(index)} />)}
        {value.options.length === 0 && <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">{t("packages.family.options.empty")}</p>}
      </section>

      </fieldset>
      <div className="flex items-center justify-between gap-3 border-t border-border pt-5">
        <Button type="button" variant="outline" onClick={onCancel}>{t("packages.steps.cancel")}</Button>
        <Button type="submit" disabled={isSubmitting || isUploading}>{isSubmitting ? t("packages.family.saving") : t("packages.family.save")}</Button>
      </div>
    </form>
  )
}

function FamilyOptionEditor({ option, index, onChange, onCopy, onRemove }: { option: PackageFamilyOptionInput; index: number; onChange: (option: PackageFamilyOptionInput) => void; onCopy: () => void; onRemove: () => void }) {
  const { t } = useLocale()
  const form = useForm<GroupedPackageFormData>({ defaultValues: familyOptionToForm(option), mode: "onBlur" })
  const formValue = useWatch({ control: form.control })
  const isDirty = form.formState.isDirty
  const lastSent = useRef(JSON.stringify(option))
  const ready = useRef(false)
  const incoming = useMemo(() => JSON.stringify(option), [option])
  const preview = familyOptionPreview(option)

  useEffect(() => {
    if (lastSent.current === incoming) return
    ready.current = false
    form.reset(familyOptionToForm(option))
    lastSent.current = incoming
  }, [form, incoming, option])

  useEffect(() => {
    if (!ready.current) {
      ready.current = true
      return
    }
    if (!isDirty) return
    const next = familyOptionFromForm(formValue as GroupedPackageFormData)
    if (option.id) next.id = option.id
    const serialized = JSON.stringify(next)
    if (!serialized || serialized === lastSent.current) return
    lastSent.current = serialized
    onChange(next)
  }, [formValue, isDirty, onChange, option.id])

  return (
    <article className="rounded-2xl border border-border bg-surface-solid p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-xs font-medium text-muted-foreground">{t("packages.family.options.optionNumber")} {index + 1}</p><h3 className="mt-1 text-base font-semibold">{option.nameAr || t("packages.family.options.unnamed")}</h3></div>
        <div className="flex items-center gap-2">
          <span data-testid={`family-option-count-${index}`} className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium tabular-nums">{familyOptionSessionCount(option)} {t("packages.summary.sessions")}</span>
          <Button type="button" variant="ghost" onClick={onCopy}>{t("packages.family.options.copy")}</Button>
          <Button type="button" variant="ghost" onClick={onRemove}>{t("packages.family.options.remove")}</Button>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t("packages.family.options.nameAr")} htmlFor={`family-option-${index}-nameAr`}><Input id={`family-option-${index}-nameAr`} {...form.register("nameAr")} dir="rtl" /></Field>
        <Field label={t("packages.family.options.nameEn")} htmlFor={`family-option-${index}-nameEn`}><Input id={`family-option-${index}-nameEn`} {...form.register("nameEn")} dir="ltr" /></Field>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-4 rounded-lg border border-border bg-surface-muted px-3 py-2">
        <label className="flex items-center gap-2 text-sm"><Switch aria-label={`${t("packages.family.options.isActive")} ${option.nameAr || t("packages.family.options.unnamed")} ${index + 1}`} checked={Boolean(formValue.isActive)} onCheckedChange={(checked) => form.setValue("isActive", checked, { shouldDirty: true })} />{t("packages.family.options.isActive")}</label>
        <label className="flex items-center gap-2 text-sm"><Switch aria-label={`${t("packages.family.options.isPublic")} ${option.nameAr || t("packages.family.options.unnamed")} ${index + 1}`} checked={Boolean(formValue.isPublic)} onCheckedChange={(checked) => form.setValue("isPublic", checked, { shouldDirty: true })} />{t("packages.family.options.isPublic")}</label>
      </div>
      <div className="mt-5"><GroupedPackageGroups form={form} idPrefix={`family-option-${index}`} translateError={(message) => message} /></div>
      <div className="mt-5"><GroupedPackagePricing form={form} idPrefix={`family-option-${index}`} preview={preview} translateError={(message) => message} /></div>
    </article>
  )
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return <div className="flex min-w-0 flex-col gap-1.5"><Label htmlFor={htmlFor}>{label}</Label>{children}</div>
}
