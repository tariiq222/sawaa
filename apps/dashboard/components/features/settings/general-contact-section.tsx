"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Card, CardContent, Button, Input, Skeleton } from "@sawaa/ui"
import { useOrganizationSettings, useUpdateOrganizationSettings } from "@/hooks/use-organization-settings"
import { useLocale } from "@/components/locale-provider"
import { FormField } from "@/components/features/shared/form-section"

type FormState = {
  contactEmail: string
  contactPhone: string
  address: string
  companyNameAr: string
  companyNameEn: string
  productTagline: string
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
  productTagline: "",
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
      productTagline: settings.productTagline ?? "",
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
        productTagline: form.productTagline || null,
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
          <FormField label={t("settings.organizationEmail")}>
            <Input value={form.contactEmail} onChange={setField("contactEmail")} type="email" dir="ltr" />
          </FormField>
          <FormField label={t("settings.organizationPhone")}>
            <Input value={form.contactPhone} onChange={setField("contactPhone")} dir="ltr" />
          </FormField>
          <div className="sm:col-span-2">
            <FormField label={t("settings.organizationAddress")}>
              <Input value={form.address} onChange={setField("address")} dir="rtl" />
            </FormField>
          </div>
        </div>

        <div className="rounded-md border border-warning/30 bg-warning/5 p-3 text-sm text-warning-foreground">
          {t("settings.entity.warning")}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t("settings.entity.companyNameAr")}>
            <Input value={form.companyNameAr} onChange={setField("companyNameAr")} dir="rtl" />
          </FormField>
          <FormField label={t("settings.entity.companyNameEn")}>
            <Input value={form.companyNameEn} onChange={setField("companyNameEn")} dir="ltr" />
          </FormField>
          <div className="sm:col-span-2">
            <FormField label={t("settings.entity.productTagline")}>
              <Input value={form.productTagline} onChange={setField("productTagline")} dir="rtl" />
              <p className="text-xs text-muted-foreground">{t("settings.entity.productTaglineHint")}</p>
            </FormField>
          </div>
          <FormField label={t("settings.entity.businessRegistration")}>
            <Input value={form.businessRegistration} onChange={setField("businessRegistration")} dir="ltr" />
          </FormField>
          <FormField label={t("settings.entity.vatRegistration")}>
            <Input value={form.vatRegistrationNumber} onChange={setField("vatRegistrationNumber")} dir="ltr" />
            <p className="text-xs text-muted-foreground">{t("settings.entity.vatHint")}</p>
          </FormField>
          <FormField label={t("settings.entity.organizationCity")}>
            <Input value={form.organizationCity} onChange={setField("organizationCity")} dir="rtl" />
          </FormField>
          <FormField label={t("settings.entity.postalCode")}>
            <Input value={form.postalCode} onChange={setField("postalCode")} dir="ltr" />
          </FormField>
          <div className="sm:col-span-2">
            <FormField label={t("settings.entity.sellerAddress")}>
              <Input value={form.sellerAddress} onChange={setField("sellerAddress")} dir="rtl" />
            </FormField>
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

