"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@sawaa/ui"
import { Label } from "@sawaa/ui"
import { Input } from "@sawaa/ui"
import { Button } from "@sawaa/ui"
import { Separator } from "@sawaa/ui"
import { useBranding } from "@/components/providers/branding-provider"
import { isValidHex } from "@/lib/color-utils"
import { useLocale } from "@/components/locale-provider"
import { BrandingColorsSection } from "./branding-colors-section"
import type {
  BrandingConfig,
  UpdateBrandingPayload,
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
            <Input value={organizationNameEn} onChange={(e) => setOrganizationNameEn(e.target.value)} dir="ltr" placeholder="Sawaa Clinic" />
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
        <div className="flex justify-end">
          <Button size="sm" disabled={isPending} onClick={handleSave}>
            {t("settings.save")}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
