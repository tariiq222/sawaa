"use client"

import { ColorSwatchInput } from "@/components/features/shared/color-swatch-input"
import { Input } from "@deqah/ui"
import { Label } from "@deqah/ui"
import { Separator } from "@deqah/ui"
import { useLocale } from "@/components/locale-provider"
import { isValidHex, contrastRatio, pickForeground } from "@/lib/color-utils"

/**
 * EXCEPTION (semantic-tokens-only rule): WCAG contrast computation requires
 * concrete hex inputs — `contrastRatio()` cannot resolve CSS custom
 * properties. These two constants are *math defaults* used only when the
 * organization has not yet picked a background color in the wizard. They never
 * paint the surface (which uses `var(--background)`); they only feed the
 * preview's score calculation. Keep them literal.
 */
const FALLBACK_PREVIEW_BG_HEX = "#f8f9fa"
const PREVIEW_TEXT_BLACK_HEX = "#1a1a1a"

function ContrastBadge({ ratio, label }: { ratio: number; label?: string }) {
  const pass = ratio >= 4.5
  const large = ratio >= 3
  const grade =
    ratio >= 7 ? "AAA" : ratio >= 4.5 ? "AA" : ratio >= 3 ? "AA Large" : "Fail"
  const color = pass ? "var(--success)" : large ? "var(--warning)" : "var(--error)"
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-xs tabular-nums"
      style={{ borderColor: color, color }}
      title={label}
    >
      {ratio.toFixed(1)}:1 · {grade}
    </span>
  )
}

interface Props {
  colorPrimary: string
  colorPrimaryLight: string
  colorPrimaryDark: string
  colorAccent: string
  colorAccentDark: string
  colorBackground: string
  organizationNameEn: string
  organizationNameAr: string
  onPrimaryChange: (v: string) => void
  onAccentChange: (v: string) => void
  onPrimaryLightChange: (v: string) => void
  onPrimaryDarkChange: (v: string) => void
  onAccentDarkChange: (v: string) => void
  onBackgroundChange: (v: string) => void
}

export function BrandingColorsSection({
  colorPrimary, colorPrimaryLight, colorPrimaryDark,
  colorAccent, colorAccentDark, colorBackground,
  organizationNameEn, organizationNameAr,
  onPrimaryChange, onAccentChange,
  onPrimaryLightChange, onPrimaryDarkChange, onAccentDarkChange, onBackgroundChange,
}: Props) {
  const { t } = useLocale()

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>{t("settings.primaryColor")}</Label>
          <div className="flex items-center gap-2">
            <ColorSwatchInput value={isValidHex(colorPrimary) ? colorPrimary : null} onChange={onPrimaryChange} defaultColor="var(--primary)" />
            <Input value={colorPrimary} onChange={(e) => onPrimaryChange(e.target.value)} placeholder="var(--primary)" className="font-mono tabular-nums" dir="ltr" />
          </div>
        </div>

        <div className="space-y-2">
          <Label>{t("branding.colorPrimaryLight")}</Label>
          <div className="flex items-center gap-2">
            <ColorSwatchInput value={isValidHex(colorPrimaryLight) ? colorPrimaryLight : null} onChange={onPrimaryLightChange} defaultColor="var(--primary-light)" />
            <Input value={colorPrimaryLight} onChange={(e) => onPrimaryLightChange(e.target.value)} placeholder="var(--primary-light)" className="font-mono tabular-nums" dir="ltr" />
          </div>
        </div>

        <div className="space-y-2">
          <Label>{t("branding.colorPrimaryDark")}</Label>
          <div className="flex items-center gap-2">
            <ColorSwatchInput value={isValidHex(colorPrimaryDark) ? colorPrimaryDark : null} onChange={onPrimaryDarkChange} defaultColor="var(--primary-dark)" />
            <Input value={colorPrimaryDark} onChange={(e) => onPrimaryDarkChange(e.target.value)} placeholder="var(--primary-dark)" className="font-mono tabular-nums" dir="ltr" />
          </div>
        </div>

        <div className="space-y-2">
          <Label>{t("settings.secondaryColor")}</Label>
          <div className="flex items-center gap-2">
            <ColorSwatchInput value={isValidHex(colorAccent) ? colorAccent : null} onChange={onAccentChange} defaultColor="var(--accent)" />
            <Input value={colorAccent} onChange={(e) => onAccentChange(e.target.value)} placeholder="var(--accent)" className="font-mono tabular-nums" dir="ltr" />
          </div>
        </div>

        <div className="space-y-2">
          <Label>{t("branding.colorAccentDark")}</Label>
          <div className="flex items-center gap-2">
            <ColorSwatchInput value={isValidHex(colorAccentDark) ? colorAccentDark : null} onChange={onAccentDarkChange} defaultColor="var(--accent-dark)" />
            <Input value={colorAccentDark} onChange={(e) => onAccentDarkChange(e.target.value)} placeholder="var(--accent-dark)" className="font-mono tabular-nums" dir="ltr" />
          </div>
        </div>

        <div className="space-y-2">
          <Label>{t("branding.colorBackground")}</Label>
          <div className="flex items-center gap-2">
            <ColorSwatchInput value={isValidHex(colorBackground) ? colorBackground : null} onChange={onBackgroundChange} defaultColor="var(--background)" />
            <Input value={colorBackground} onChange={(e) => onBackgroundChange(e.target.value)} placeholder="var(--background)" className="font-mono tabular-nums" dir="ltr" />
          </div>
        </div>
      </div>

      {isValidHex(colorPrimary) && (
        <>
          <Separator />
          <div className="space-y-3">
            <Label className="text-xs text-muted-foreground">{t("settings.preview")}</Label>

            <div className="flex flex-wrap items-center gap-2">
              <div className="size-8 rounded-md shadow-sm ring-1 ring-border" style={{ background: colorPrimary }} title={colorPrimary} />
              {isValidHex(colorPrimaryLight) && <div className="size-8 rounded-md shadow-sm ring-1 ring-border" style={{ background: colorPrimaryLight }} title={colorPrimaryLight} />}
              {isValidHex(colorPrimaryDark) && <div className="size-8 rounded-md shadow-sm ring-1 ring-border" style={{ background: colorPrimaryDark }} title={colorPrimaryDark} />}
              {isValidHex(colorAccent) && <div className="size-8 rounded-md shadow-sm ring-1 ring-border" style={{ background: colorAccent }} title={colorAccent} />}
              {isValidHex(colorAccentDark) && <div className="size-8 rounded-md shadow-sm ring-1 ring-border" style={{ background: colorAccentDark }} title={colorAccentDark} />}
              {isValidHex(colorBackground) && <div className="size-8 rounded-md border shadow-sm ring-1 ring-border" style={{ background: colorBackground }} title={colorBackground} />}
            </div>

            <div className="space-y-3 rounded-lg border p-4" style={{ background: isValidHex(colorBackground) ? colorBackground : "var(--background)" }}>
              <div className="flex items-center gap-3">
                <div className="inline-flex items-center rounded-full px-4 py-1.5 text-sm font-medium shadow-sm" style={{ background: colorPrimary, color: pickForeground(colorPrimary) }}>
                  {organizationNameEn || organizationNameAr || "Deqah"}
                </div>
                <ContrastBadge ratio={contrastRatio(colorPrimary, isValidHex(colorBackground) ? colorBackground : FALLBACK_PREVIEW_BG_HEX)} />
              </div>

              {isValidHex(colorAccent) && (
                <div className="flex items-center gap-3">
                  <div className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium" style={{ background: colorAccent, color: pickForeground(colorAccent) }}>
                    {t("branding.preview.badge")}
                  </div>
                  <ContrastBadge ratio={contrastRatio(colorAccent, isValidHex(colorBackground) ? colorBackground : FALLBACK_PREVIEW_BG_HEX)} label={t("branding.preview.accentOnBg")} />
                </div>
              )}

              <div className="flex items-center gap-3">
                <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{t("branding.preview.primaryText")}</p>
                <ContrastBadge ratio={contrastRatio(PREVIEW_TEXT_BLACK_HEX, isValidHex(colorBackground) ? colorBackground : FALLBACK_PREVIEW_BG_HEX)} label={t("branding.preview.textOnBg")} />
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
