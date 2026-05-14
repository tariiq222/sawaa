"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Card, CardContent } from "@deqah/ui"
import { Label } from "@deqah/ui"
import { Input } from "@deqah/ui"
import { Textarea } from "@deqah/ui"
import { Button } from "@deqah/ui"
import { Skeleton } from "@deqah/ui"
import { cn } from "@/lib/utils"
import { useOrganizationSettings, useUpdateOrganizationSettings } from "@/hooks/use-organization-settings"
import { useLocale } from "@/components/locale-provider"

// ─── helpers ─────────────────────────────────────────────────────────────────

function toPercentRate(rate: number | null | undefined): string {
  if (rate == null) return "15"
  return String(rate <= 1 ? rate * 100 : rate)
}

interface BilingualField {
  ar: string
  en: string
}

type SectionId = "entity" | "about" | "privacy" | "terms" | "cancellation"

// ─── bilingual textarea section ───────────────────────────────────────────────

function BilingualSection({ field, onChange, t }: {
  field: BilingualField
  onChange: (field: BilingualField) => void
  t: (key: string) => string
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label>{t("common.arabic")}</Label>
        <Textarea
          value={field.ar}
          onChange={(e) => onChange({ ...field, ar: e.currentTarget.value })}
          dir="rtl"
          rows={10}
          className="resize-y"
        />
      </div>
      <div className="space-y-2">
        <Label>{t("common.english") ?? "English"}</Label>
        <Textarea
          value={field.en}
          onChange={(e) => onChange({ ...field, en: e.currentTarget.value })}
          dir="ltr"
          rows={10}
          className="resize-y"
        />
      </div>
    </div>
  )
}

// ─── main component ───────────────────────────────────────────────────────────

export function LegalContentTab() {
  const { t } = useLocale()
  const { data: settings, isLoading } = useOrganizationSettings()
  const updateSettings = useUpdateOrganizationSettings()
  const [activeSection, setActiveSection] = useState<SectionId>("entity")

  // ── entity fields ──
  const [companyNameAr, setCompanyNameAr] = useState("")
  const [companyNameEn, setCompanyNameEn] = useState("")
  const [businessRegistration, setBusinessRegistration] = useState("")
  const [vatRegistrationNumber, setVatRegistrationNumber] = useState("")
  const [vatRate, setVatRate] = useState("15")
  const [sellerAddress, setSellerAddress] = useState("")
  const [organizationCity, setClinicCity] = useState("")
  const [postalCode, setPostalCode] = useState("")

  // ── legal content fields ──
  const [about, setAbout] = useState<BilingualField>({ ar: "", en: "" })
  const [privacy, setPrivacy] = useState<BilingualField>({ ar: "", en: "" })
  const [terms, setTerms] = useState<BilingualField>({ ar: "", en: "" })
  const [cancellation, setCancellation] = useState<BilingualField>({ ar: "", en: "" })

  useEffect(() => {
    if (!settings) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCompanyNameAr(settings.companyNameAr ?? "")
    setCompanyNameEn(settings.companyNameEn ?? "")
    setBusinessRegistration(settings.businessRegistration ?? "")
    setVatRegistrationNumber(settings.vatRegistrationNumber ?? "")
    setVatRate(toPercentRate(settings.vatRate))
    setSellerAddress(settings.sellerAddress ?? "")
    setClinicCity(settings.organizationCity ?? "")
    setPostalCode(settings.postalCode ?? "")

    setAbout({ ar: settings.aboutAr ?? "", en: settings.aboutEn ?? "" })
    setPrivacy({ ar: settings.privacyPolicyAr ?? "", en: settings.privacyPolicyEn ?? "" })
    setTerms({ ar: settings.termsAr ?? "", en: settings.termsEn ?? "" })
    setCancellation({ ar: settings.cancellationPolicyAr ?? "", en: settings.cancellationPolicyEn ?? "" })
  }, [settings])

  const handleEntitySave = () => {
    updateSettings.mutate(
      {
        companyNameAr: companyNameAr || null,
        companyNameEn: companyNameEn || null,
        businessRegistration: businessRegistration || null,
        vatRegistrationNumber: vatRegistrationNumber || null,
        vatRate: Number(vatRate) / 100,
        sellerAddress: sellerAddress || null,
        organizationCity,
        postalCode: postalCode || null,
      },
      {
        onSuccess: () => toast.success(t("settings.saved")),
        onError: () => toast.error(t("settings.error")),
      },
    )
  }

  const handleLegalSave = () => {
    updateSettings.mutate(
      {
        aboutAr: about.ar || null,
        aboutEn: about.en || null,
        privacyPolicyAr: privacy.ar || null,
        privacyPolicyEn: privacy.en || null,
        termsAr: terms.ar || null,
        termsEn: terms.en || null,
        cancellationPolicyAr: cancellation.ar || null,
        cancellationPolicyEn: cancellation.en || null,
      },
      {
        onSuccess: () => toast.success(t("settings.saved")),
        onError: () => toast.error(t("settings.error")),
      },
    )
  }

  const sections: { id: SectionId; label: string }[] = [
    { id: "entity",       label: t("settings.tabs.entity") },
    { id: "about",        label: t("settings.legal.about") },
    { id: "privacy",      label: t("settings.legal.privacy") },
    { id: "terms",        label: t("settings.legal.terms") },
    { id: "cancellation", label: t("settings.legal.cancellation") },
  ]

  if (isLoading) {
    return (
      <Card className="overflow-hidden p-0">
        <div className="flex min-h-[520px]">
          <div className="w-56 shrink-0 border-e border-border bg-surface-muted p-3 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={`skeleton-${i}`} className="h-10 rounded-lg" />
            ))}
          </div>
          <div className="flex-1 p-6 space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-64 rounded-lg" />
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex min-h-[520px]">

        {/* ── Sidebar ─────────────────────────────────────────── */}
        <div className="flex w-56 shrink-0 flex-col border-e border-border bg-surface-muted">
          <div className="border-b border-border px-4 py-3">
            <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              {t("settings.tabs.legal")}
            </p>
          </div>
          <div role="tablist" className="flex-1 space-y-1.5 p-3">
            {sections.map((section) => {
              const isActive = activeSection === section.id
              return (
                <div
                  key={section.id}
                  role="tab"
                  aria-selected={isActive}
                  tabIndex={0}
                  onClick={() => setActiveSection(section.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") setActiveSection(section.id)
                  }}
                  className={cn(
                    "w-full cursor-pointer rounded-lg px-3 py-2.5 transition-all select-none",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
                  )}
                >
                  <p className="truncate text-sm leading-tight font-medium">
                    {section.label}
                  </p>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Content panel ────────────────────────────────────── */}
        <div className="flex flex-1 flex-col overflow-y-auto bg-surface-muted/50 p-5">

          {/* Entity */}
          {activeSection === "entity" && (
            <div className="space-y-4">
              <div className="rounded-lg border border-warning/20 bg-warning/5 px-4 py-3">
                <p className="text-sm text-warning-foreground">
                  {t("settings.entity.warning")}
                </p>
              </div>
              <CardContent className="rounded-lg border bg-background p-6 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t("settings.entity.companyNameAr")}</Label>
                    <Input value={companyNameAr} onChange={(e) => setCompanyNameAr(e.target.value)} dir="rtl" />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("settings.entity.companyNameEn")}</Label>
                    <Input value={companyNameEn} onChange={(e) => setCompanyNameEn(e.target.value)} dir="ltr" />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("settings.entity.businessRegistration")}</Label>
                    <Input value={businessRegistration} onChange={(e) => setBusinessRegistration(e.target.value)} dir="ltr" />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("settings.entity.vatRegistration")}</Label>
                    <Input value={vatRegistrationNumber} onChange={(e) => setVatRegistrationNumber(e.target.value)} dir="ltr" />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("settings.entity.vatRate")}</Label>
                    <Input value={vatRate} onChange={(e) => setVatRate(e.target.value)} type="number" min="0" max="100" dir="ltr" />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("settings.entity.sellerAddress")}</Label>
                    <Input value={sellerAddress} onChange={(e) => setSellerAddress(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("settings.entity.organizationCity")}</Label>
                    <Input value={organizationCity} onChange={(e) => setClinicCity(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("settings.entity.postalCode")}</Label>
                    <Input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} dir="ltr" />
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <Button size="sm" disabled={updateSettings.isPending} onClick={handleEntitySave}>
                    {t("settings.save")}
                  </Button>
                </div>
              </CardContent>
            </div>
          )}

          {/* About */}
          {activeSection === "about" && (
            <div className="space-y-4">
              <BilingualSection field={about} onChange={setAbout} t={t} />
              <div className="flex justify-end">
                <Button size="sm" disabled={updateSettings.isPending} onClick={handleLegalSave}>
                  {t("settings.save")}
                </Button>
              </div>
            </div>
          )}

          {/* Privacy */}
          {activeSection === "privacy" && (
            <div className="space-y-4">
              <BilingualSection field={privacy} onChange={setPrivacy} t={t} />
              <div className="flex justify-end">
                <Button size="sm" disabled={updateSettings.isPending} onClick={handleLegalSave}>
                  {t("settings.save")}
                </Button>
              </div>
            </div>
          )}

          {/* Terms */}
          {activeSection === "terms" && (
            <div className="space-y-4">
              <BilingualSection field={terms} onChange={setTerms} t={t} />
              <div className="flex justify-end">
                <Button size="sm" disabled={updateSettings.isPending} onClick={handleLegalSave}>
                  {t("settings.save")}
                </Button>
              </div>
            </div>
          )}

          {/* Cancellation */}
          {activeSection === "cancellation" && (
            <div className="space-y-4">
              <BilingualSection field={cancellation} onChange={setCancellation} t={t} />
              <div className="flex justify-end">
                <Button size="sm" disabled={updateSettings.isPending} onClick={handleLegalSave}>
                  {t("settings.save")}
                </Button>
              </div>
            </div>
          )}

        </div>
      </div>
    </Card>
  )
}
