"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Card, CardContent, Button, Input, Label, Skeleton } from "@sawaa/ui"
import { useOrganizationSettings, useUpdateOrganizationSettings } from "@/hooks/use-organization-settings"
import { useLocale } from "@/components/locale-provider"

type FormState = {
  companyNameAr: string
  companyNameEn: string
  businessRegistration: string
  vatRegistrationNumber: string
  sellerAddress: string
  organizationCity: string
  postalCode: string
}

const EMPTY_FORM: FormState = {
  companyNameAr: "",
  companyNameEn: "",
  businessRegistration: "",
  vatRegistrationNumber: "",
  sellerAddress: "",
  organizationCity: "",
  postalCode: "",
}

export function EntityTab() {
  const { t } = useLocale()
  const { data: settings, isLoading } = useOrganizationSettings()
  const update = useUpdateOrganizationSettings()
  const [form, setForm] = useState<FormState>(EMPTY_FORM)

  useEffect(() => {
    if (!settings) return
    setForm({
      companyNameAr: settings.companyNameAr ?? "",
      companyNameEn: settings.companyNameEn ?? "",
      businessRegistration: settings.businessRegistration ?? "",
      vatRegistrationNumber: settings.vatRegistrationNumber ?? "",
      sellerAddress: settings.sellerAddress ?? "",
      organizationCity: settings.organizationCity ?? "",
      postalCode: settings.postalCode ?? "",
    })
  }, [settings])

  const setField = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
  }

  const handleSave = async () => {
    try {
      await update.mutateAsync({
        companyNameAr: form.companyNameAr || null,
        companyNameEn: form.companyNameEn || null,
        businessRegistration: form.businessRegistration || null,
        vatRegistrationNumber: form.vatRegistrationNumber || null,
        sellerAddress: form.sellerAddress || null,
        organizationCity: form.organizationCity,
        postalCode: form.postalCode || null,
      })
      toast.success(t("common.saved") ?? "Saved")
    } catch {
      toast.error(t("common.saveFailed") ?? "Save failed")
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="space-y-6 p-6">
        <div className="rounded-md border border-warning/30 bg-warning/5 p-3 text-sm text-warning-foreground">
          {t("settings.entity.warning")}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("settings.entity.companyNameAr")} value={form.companyNameAr} onChange={setField("companyNameAr")} dir="rtl" />
          <Field label={t("settings.entity.companyNameEn")} value={form.companyNameEn} onChange={setField("companyNameEn")} dir="ltr" />
          <Field label={t("settings.entity.businessRegistration")} value={form.businessRegistration} onChange={setField("businessRegistration")} dir="ltr" />
          <FieldWithHint
            label={t("settings.entity.vatRegistration")}
            value={form.vatRegistrationNumber}
            onChange={setField("vatRegistrationNumber")}
            dir="ltr"
            hint="مطلوب لظهور باركود ZATCA على فواتير العملاء. لو فاضي، الفاتورة تطلع بدون باركود."
          />
          <Field label={t("settings.entity.organizationCity")} value={form.organizationCity} onChange={setField("organizationCity")} dir="rtl" />
          <Field label={t("settings.entity.postalCode")} value={form.postalCode} onChange={setField("postalCode")} dir="ltr" />
          <div className="sm:col-span-2">
            <Field label={t("settings.entity.sellerAddress")} value={form.sellerAddress} onChange={setField("sellerAddress")} dir="rtl" />
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={update.isPending}>
            {update.isPending ? t("common.saving") ?? "..." : t("common.save") ?? "Save"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function Field({ label, value, onChange, dir }: {
  label: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  dir: "ltr" | "rtl"
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input value={value} onChange={onChange} dir={dir} />
    </div>
  )
}

function FieldWithHint({ label, value, onChange, dir, hint }: {
  label: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  dir: "ltr" | "rtl"
  hint: string
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input value={value} onChange={onChange} dir={dir} />
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}
