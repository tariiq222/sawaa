"use client"

import type { UseFormReturn } from "react-hook-form"
import {
  Input,
  Textarea,
  Label,
  Switch,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
} from "@sawaa/ui"
import { HugeiconsIcon } from "@hugeicons/react"
import { AlertCircleIcon } from "@hugeicons/core-free-icons"
import {
  FormSection,
  FormField,
} from "@/components/features/shared/form-section"
import { ServiceAvatarPicker } from "@/components/features/shared/service-avatar-picker"
import { useLocale } from "@/components/locale-provider"
import { useAllEmployees } from "@/hooks/use-employees"
import type { PackageFormData } from "@/lib/schemas/package.schema"
import { packageEmployeeLabel } from "@/lib/package-editor-labels"

interface Props {
  form: UseFormReturn<PackageFormData>
  onImageSelect?: (file: File) => void
  translateError: (msg?: string) => string | undefined
}

export function PackageDetailsFields({
  form,
  onImageSelect,
  translateError,
}: Props) {
  const { t } = useLocale()
  const { employees } = useAllEmployees()
  const errors = form.formState.errors
  const ownerId = form.watch("ownerEmployeeId")
  const owner = employees.find((employee) => employee.id === ownerId)
  const ownerName = owner
    ? packageEmployeeLabel(owner, t("packages.review.unavailable"))
    : ownerId
      ? t("packages.review.unavailable")
      : ""
  const statusItems = [
    {
      id: "package-active",
      label: t("packages.edit.isActive"),
      desc: t("packages.edit.isActiveDesc"),
      field: "isActive" as const,
    },
    {
      id: "package-public",
      label: t("packages.edit.isPublic"),
      desc: t("packages.edit.isPublicDesc"),
      field: "isPublic" as const,
    },
  ]
  return (
    <FormSection>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className="flex min-w-0 items-start gap-4">
          <ServiceAvatarPicker
            iconName={form.watch("iconName")}
            iconBgColor={form.watch("iconBgColor")}
            imageUrl={form.watch("imageUrl")}
            serviceName={form.watch("nameAr") || form.watch("nameEn")}
            onIconChange={(name, color) => {
              form.setValue("iconName", name)
              form.setValue("iconBgColor", color)
              form.setValue("imageUrl", null)
            }}
            onImageChange={(file) => {
              form.setValue("imageUrl", URL.createObjectURL(file))
              form.setValue("iconName", null)
              form.setValue("iconBgColor", null)
              onImageSelect?.(file)
            }}
            onClear={() => {
              form.setValue("iconName", null)
              form.setValue("iconBgColor", null)
              form.setValue("imageUrl", null)
            }}
          />
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-sm font-semibold text-foreground">
              {t("packages.section.basic")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("packages.create.basicDesc")} —{" "}
              <span className="text-destructive">*</span>{" "}
              {t("packages.create.requiredFields")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("packages.create.avatarHint")}
            </p>
          </div>
        </div>
        <div className="w-full shrink-0 rounded-lg border border-border bg-surface-muted p-3 sm:w-auto">
          <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {t("packages.section.status")}
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {statusItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface px-2 py-1.5"
              >
                <div className="flex min-w-0 items-center gap-1">
                  <Label
                    htmlFor={item.id}
                    className="cursor-pointer truncate text-xs leading-none"
                  >
                    {item.label}
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                        aria-label={item.label}
                      >
                        <HugeiconsIcon
                          icon={AlertCircleIcon}
                          size={12}
                          strokeWidth={2}
                        />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent side="bottom" align="end" className="w-64">
                      <PopoverHeader>
                        <PopoverTitle>{item.label}</PopoverTitle>
                        <PopoverDescription>{item.desc}</PopoverDescription>
                      </PopoverHeader>
                    </PopoverContent>
                  </Popover>
                </div>
                <Switch
                  id={item.id}
                  checked={!!form.watch(item.field)}
                  onCheckedChange={(value) => form.setValue(item.field, value)}
                  size="sm"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField
          label={t("packages.create.nameAr")}
          required
          error={translateError(errors.nameAr?.message)}
        >
          <Input {...form.register("nameAr")} dir="rtl" />
        </FormField>
        <FormField label={t("packages.create.nameEn")}>
          <Input {...form.register("nameEn")} dir="ltr" />
        </FormField>
        <FormField label={t("packages.create.descriptionAr")}>
          <Textarea {...form.register("descriptionAr")} dir="rtl" rows={2} />
        </FormField>
        <FormField label={t("packages.create.descriptionEn")}>
          <Textarea {...form.register("descriptionEn")} dir="ltr" rows={2} />
        </FormField>
      </div>
      <div className="mt-5 max-w-md">
        <FormField
          label={t("packages.owner.label")}
          error={translateError(errors.ownerEmployeeId?.message)}
        >
          <Select
            value={ownerId ?? "__general__"}
            onValueChange={(value) => {
              if (value === "") return
              const next = value === "__general__" ? null : value
              if (next === (ownerId ?? null)) return
              form.setValue("ownerEmployeeId", next, { shouldDirty: true })
              form.setValue(
                "ownerChangeRevision",
                (form.getValues("ownerChangeRevision") ?? 0) + 1,
                { shouldDirty: true }
              )
              if (next)
                (form.getValues("items") ?? []).forEach((item, index) => {
                  form.setValue(
                    `items.${index}.practitioner`,
                    { mode: "INCLUDE", ids: [next] } as never,
                    { shouldDirty: true }
                  )
                  const original = item.originalConstraints
                  if (original) {
                    const row = {
                      dimension: "PRACTITIONER" as const,
                      mode: "INCLUDE" as const,
                      targetIds: [next],
                    }
                    form.setValue(
                      `items.${index}.originalConstraints`,
                      original.some((c) => c.dimension === "PRACTITIONER")
                        ? original.map((c) =>
                            c.dimension === "PRACTITIONER" ? row : c
                          )
                        : [...original, row],
                      { shouldDirty: true }
                    )
                  }
                })
            }}
          >
            <SelectTrigger
              id="package-owner"
              aria-label={t("packages.owner.label")}
            >
              <SelectValue placeholder={t("packages.owner.general")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__general__">
                {t("packages.owner.general")}
              </SelectItem>
              {employees
                .filter((employee) => employee.isActive)
                .map((employee) => (
                  <SelectItem key={employee.id} value={employee.id}>
                    {packageEmployeeLabel(
                      employee,
                      t("packages.review.unavailable")
                    )}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </FormField>
        <p className="mt-1 text-xs text-muted-foreground">
          {ownerId
            ? `${ownerName} — ${t("packages.owner.inheritedHint")}`
            : t("packages.owner.generalHint")}
        </p>
      </div>
    </FormSection>
  )
}
