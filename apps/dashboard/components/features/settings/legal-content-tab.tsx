"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Card } from "@sawaa/ui"
import { Label } from "@sawaa/ui"
import { Textarea } from "@sawaa/ui"
import { Button } from "@sawaa/ui"
import { Skeleton } from "@sawaa/ui"
import { useOrganizationSettings, useUpdateOrganizationSettings } from "@/hooks/use-organization-settings"
import { useLocale } from "@/components/locale-provider"
import { SettingsTabSidebar } from "./settings-tab-sidebar"

// ─── helpers ─────────────────────────────────────────────────────────────────

interface BilingualField {
  ar: string
  en: string
}

type SectionId = "about" | "privacy" | "terms" | "cancellation"

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
  const [activeSection, setActiveSection] = useState<SectionId>("about")

  // ── legal content fields ──
  const [about, setAbout] = useState<BilingualField>({ ar: "", en: "" })
  const [privacy, setPrivacy] = useState<BilingualField>({ ar: "", en: "" })
  const [terms, setTerms] = useState<BilingualField>({ ar: "", en: "" })
  const [cancellation, setCancellation] = useState<BilingualField>({ ar: "", en: "" })

  useEffect(() => {
    if (!settings) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAbout({ ar: settings.aboutAr ?? "", en: settings.aboutEn ?? "" })
    setPrivacy({ ar: settings.privacyPolicyAr ?? "", en: settings.privacyPolicyEn ?? "" })
    setTerms({ ar: settings.termsAr ?? "", en: settings.termsEn ?? "" })
    setCancellation({ ar: settings.cancellationPolicyAr ?? "", en: settings.cancellationPolicyEn ?? "" })
  }, [settings])

  const handleLegalSave = () => {
    let payload: Record<string, string | null> = {}
    switch (activeSection) {
      case "about":
        payload = { aboutAr: about.ar || null, aboutEn: about.en || null }
        break
      case "privacy":
        payload = { privacyPolicyAr: privacy.ar || null, privacyPolicyEn: privacy.en || null }
        break
      case "terms":
        payload = { termsAr: terms.ar || null, termsEn: terms.en || null }
        break
      case "cancellation":
        payload = { cancellationPolicyAr: cancellation.ar || null, cancellationPolicyEn: cancellation.en || null }
        break
    }
    updateSettings.mutate(payload, {
      onSuccess: () => toast.success(t("settings.saved")),
      onError: () => toast.error(t("settings.error")),
    })
  }

  const sections: { id: SectionId; label: string }[] = [
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
            {Array.from({ length: 4 }).map((_, i) => (
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
        <SettingsTabSidebar
          title={t("settings.tabs.legal")}
          items={sections.map(s => ({ id: s.id, label: s.label }))}
          activeId={activeSection}
          onSelect={(id) => setActiveSection(id as SectionId)}
          width="w-56"
        />

        {/* ── Content panel ────────────────────────────────────── */}
        <div className="flex flex-1 flex-col overflow-y-auto bg-surface-muted/50 p-5">

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
