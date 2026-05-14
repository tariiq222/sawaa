"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@deqah/ui"
import { Label } from "@deqah/ui"
import { Input } from "@deqah/ui"
import { Button } from "@deqah/ui"
import { Separator } from "@deqah/ui"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deqah/ui"
import { useBranding } from "@/components/providers/branding-provider"
import { isValidHex } from "@/lib/color-utils"
import { useLocale } from "@/components/locale-provider"
import { BrandingColorsSection } from "./branding-colors-section"
import type {
  BrandingConfig,
  UpdateBrandingPayload,
  WebsiteTheme,
} from "@/lib/types/branding"

interface Props {
  branding: BrandingConfig | null
  onSave: (data: UpdateBrandingPayload) => void
  isPending: boolean
}

export function BrandingForm({ branding, onSave, isPending }: Props) {
  const { t } = useLocale()
  const [organizationNameEn, setOrganizationNameEn] = useState("")
  const [organizationNameAr, setOrganizationNameAr] = useState("")
  const [productTagline, setProductTagline] = useState("")
  const [colorPrimary, setColorPrimary] = useState("")
  const [colorPrimaryLight, setColorPrimaryLight] = useState("")
  const [colorPrimaryDark, setColorPrimaryDark] = useState("")
  const [colorAccent, setColorAccent] = useState("")
  const [colorAccentDark, setColorAccentDark] = useState("")
  const [colorBackground, setColorBackground] = useState("")
  const [fontFamily, setFontFamily] = useState("")
  const [fontUrl, setFontUrl] = useState("")
  const [logoUrl, setLogoUrl] = useState("")
  const [faviconUrl, setFaviconUrl] = useState("")
  const [websiteDomain, setWebsiteDomain] = useState("")
  const [activeWebsiteTheme, setActiveWebsiteTheme] = useState<WebsiteTheme>("SAWAA")

  const { preview, clearPreview, apply } = useBranding()

  useEffect(() => {
    if (!branding) return
    // Seed form from async-loaded server data; users edit these freely afterwards.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrganizationNameEn(branding.organizationNameEn ?? "")
    setOrganizationNameAr(branding.organizationNameAr ?? "")
    setProductTagline(branding.productTagline ?? "")
    setColorPrimary(branding.colorPrimary ?? "")
    setColorPrimaryLight(branding.colorPrimaryLight ?? "")
    setColorPrimaryDark(branding.colorPrimaryDark ?? "")
    setColorAccent(branding.colorAccent ?? "")
    setColorAccentDark(branding.colorAccentDark ?? "")
    setColorBackground(branding.colorBackground ?? "")
    setFontFamily(branding.fontFamily ?? "")
    setFontUrl(branding.fontUrl ?? "")
    setLogoUrl(branding.logoUrl ?? "")
    setFaviconUrl(branding.faviconUrl ?? "")
    setWebsiteDomain(branding.websiteDomain ?? "")
    setActiveWebsiteTheme(branding.activeWebsiteTheme ?? "SAWAA")
  }, [branding])

  const updatePreview = useCallback(
    (primary: string, accent: string) => {
      if (isValidHex(primary)) {
        preview({ primary, accent: isValidHex(accent) ? accent : primary })
      }
    },
    [preview]
  )

  const handlePrimaryChange = (value: string) => {
    setColorPrimary(value)
    updatePreview(value, colorAccent)
  }

  const handleAccentChange = (value: string) => {
    setColorAccent(value)
    updatePreview(colorPrimary, value)
  }

  useEffect(() => clearPreview, [clearPreview])

  const handleSave = () => {
    onSave({
      organizationNameEn: organizationNameEn || null,
      organizationNameAr,
      productTagline: productTagline || null,
      colorPrimary: colorPrimary || null,
      colorPrimaryLight: colorPrimaryLight || null,
      colorPrimaryDark: colorPrimaryDark || null,
      colorAccent: colorAccent || null,
      colorAccentDark: colorAccentDark || null,
      colorBackground: colorBackground || null,
      fontFamily: fontFamily || null,
      fontUrl: fontUrl || null,
      logoUrl: logoUrl || null,
      faviconUrl: faviconUrl || null,
      websiteDomain: websiteDomain || null,
      activeWebsiteTheme,
    })
    if (isValidHex(colorPrimary)) {
      apply({ primary: colorPrimary, accent: isValidHex(colorAccent) ? colorAccent : colorPrimary })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.tabs.branding")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t("branding.organizationNameEn")}</Label>
            <Input value={organizationNameEn} onChange={(e) => setOrganizationNameEn(e.target.value)} dir="ltr" placeholder="Deqah Clinic" />
          </div>
          <div className="space-y-2">
            <Label>{t("branding.organizationNameAr")}</Label>
            <Input value={organizationNameAr} onChange={(e) => setOrganizationNameAr(e.target.value)} dir="rtl" placeholder={t("branding.organizationNamePlaceholderAr")} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>{t("branding.productTagline")}</Label>
            <Input value={productTagline} onChange={(e) => setProductTagline(e.target.value)} placeholder={t("branding.productTaglinePlaceholder")} />
          </div>
        </div>

        <Separator />

        <BrandingColorsSection
          colorPrimary={colorPrimary}
          colorPrimaryLight={colorPrimaryLight}
          colorPrimaryDark={colorPrimaryDark}
          colorAccent={colorAccent}
          colorAccentDark={colorAccentDark}
          colorBackground={colorBackground}
          organizationNameEn={organizationNameEn}
          organizationNameAr={organizationNameAr}
          onPrimaryChange={handlePrimaryChange}
          onAccentChange={handleAccentChange}
          onPrimaryLightChange={setColorPrimaryLight}
          onPrimaryDarkChange={setColorPrimaryDark}
          onAccentDarkChange={setColorAccentDark}
          onBackgroundChange={setColorBackground}
        />

        <Separator />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t("settings.fontFamily")}</Label>
            <Input value={fontFamily} onChange={(e) => setFontFamily(e.target.value)} placeholder="IBM Plex Sans Arabic" />
          </div>
          <div className="space-y-2">
            <Label>{t("branding.fontUrl")}</Label>
            <Input value={fontUrl} onChange={(e) => setFontUrl(e.target.value)} placeholder="https://fonts.googleapis.com/..." dir="ltr" />
          </div>
          <div className="space-y-2">
            <Label>{t("settings.logoUrl")}</Label>
            <Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://..." dir="ltr" />
          </div>
          <div className="space-y-2">
            <Label>{t("settings.faviconUrl")}</Label>
            <Input value={faviconUrl} onChange={(e) => setFaviconUrl(e.target.value)} placeholder="https://..." dir="ltr" />
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <div>
            <h3 className="text-base font-semibold">{t("branding.website.title")}</h3>
            <p className="text-sm text-muted-foreground">{t("branding.website.description")}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="website-domain">{t("branding.website.domain")}</Label>
              <Input id="website-domain" value={websiteDomain} onChange={(e) => setWebsiteDomain(e.target.value)} placeholder="clinic.example.com" dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website-theme">{t("branding.website.theme")}</Label>
              <Select value={activeWebsiteTheme} onValueChange={(v) => setActiveWebsiteTheme(v as WebsiteTheme)}>
                <SelectTrigger id="website-theme"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SAWAA">{t("branding.website.themes.sawaa")}</SelectItem>
                  <SelectItem value="PREMIUM">{t("branding.website.themes.premium")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <Separator />
        <div className="flex justify-end">
          <Button size="sm" disabled={isPending} onClick={handleSave}>
            {t("settings.save")}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
