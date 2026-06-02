"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Card, CardContent, Button, Input, Label, Skeleton } from "@sawaa/ui"
import { useOrganizationSettings, useUpdateOrganizationSettings } from "@/hooks/use-organization-settings"
import { useLocale } from "@/components/locale-provider"

type FormState = {
  contactEmail: string
  contactPhone: string
  address: string
  companyNameAr: string
  companyNameEn: string
  businessRegistration: string
  vatRegistrationNumber: string
  sellerAddress: string
  organizationCity: string
  postalCode: string
}

const EMPTY_FORM: FormState = {
  contactEmail: "",
  contactPhone: "",
  address: "",
  companyNameAr: "",
  companyNameEn: "",
  businessRegistration: "",
  vatRegistrationNumber: "",
  sellerAddress: "",
  organizationCity: "",
  postalCode: "",
}

export function GeneralContactSection() {
  const { t } = useLocale()
  const { data: settings, isLoading } = useOrganizationSettings()
  const update = useUpdateOrganizationSettings()
  const [form, setForm] = useState<FormState>(EMPTY_FORM)

  useEffect(() => {
    if (!settings) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm({
      contactEmail: settings.contactEmail ?? "",
      contactPhone: settings.contactPhone ?? "",
      address: settings.address ?? "",
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

  const handleSave = () => {
    update.mutate(
      {
        contactEmail: form.contactEmail || null,
        contactPhone: form.contactPhone || null,
        address: form.address || null,
        companyNameAr: form.companyNameAr || null,
        companyNameEn: form.companyNameEn || null,
        businessRegistration: form.businessRegistration || null,
        vatRegistrationNumber: form.vatRegistrationNumber || null,
        sellerAddress: form.sellerAddress || null,
        organizationCity: form.organizationCity,
        postalCode: form.postalCode || null,
      },
      {
        onSuccess: () => toast.success(t("settings.saved")),
        onError: () => toast.error(t("settings.error")),
      },
    )
  }

  if (isLoading) {
    return (
      <Card className="shadow-sm bg-surface">
        <CardContent className="space-y-3 p-6">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="shadow-sm bg-surface">
      <CardContent className="space-y-6 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("settings.organizationEmail")} value={form.contactEmail} onChange={setField("contactEmail")} type="email" dir="ltr" />
          <Field label={t("settings.organizationPhone")} value={form.contactPhone} onChange={setField("contactPhone")} dir="ltr" />
          <div className="sm:col-span-2">
            <Field label={t("settings.organizationAddress")} value={form.address} onChange={setField("address")} dir="rtl" />
          </div>
        </div>

        <div className="rounded-md border border-warning/30 bg-warning/5 p-3 text-sm text-warning-foreground">
          {t("settings.entity.warning")}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("settings.entity.companyNameAr")} value={form.companyNameAr} onChange={setField("companyNameAr")} dir="rtl" />
          <Field label={t("settings.entity.companyNameEn")} value={form.companyNameEn} onChange={setField("companyNameEn")} dir="ltr" />
          <Field label={t("settings.entity.businessRegistration")} value={form.businessRegistration} onChange={setField("businessRegistration")} dir="ltr" />
          <Field
            label={t("settings.entity.vatRegistration")}
            value={form.vatRegistrationNumber}
            onChange={setField("vatRegistrationNumber")}
            dir="ltr"
            hint={t("settings.entity.vatHint")}
          />
          <Field label={t("settings.entity.organizationCity")} value={form.organizationCity} onChange={setField("organizationCity")} dir="rtl" />
          <Field label={t("settings.entity.postalCode")} value={form.postalCode} onChange={setField("postalCode")} dir="ltr" />
          <div className="sm:col-span-2">
            <Field label={t("settings.entity.sellerAddress")} value={form.sellerAddress} onChange={setField("sellerAddress")} dir="rtl" />
          </div>
        </div>

        <div className="flex justify-end">
          <Button size="sm" onClick={handleSave} disabled={update.isPending}>
            {t("settings.save")}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function Field({ label, value, onChange, dir, type, hint }: {
  label: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  dir: "ltr" | "rtl"
  type?: string
  hint?: string
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input value={value} onChange={onChange} dir={dir} type={type} />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
