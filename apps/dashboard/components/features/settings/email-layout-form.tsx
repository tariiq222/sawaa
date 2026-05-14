"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Card, CardContent } from "@deqah/ui"
import { Button } from "@deqah/ui"
import { Input } from "@deqah/ui"
import { Label } from "@deqah/ui"
import { Switch } from "@deqah/ui"
import { Skeleton } from "@deqah/ui"
import { useOrganizationSettings, useUpdateOrganizationSettings } from "@/hooks/use-organization-settings"
import { useLocale } from "@/components/locale-provider"

interface LayoutState {
  emailHeaderShowLogo: boolean
  emailHeaderShowName: boolean
  emailFooterPhone: string
  emailFooterWebsite: string
  emailFooterInstagram: string
  emailFooterTwitter: string
  emailFooterSnapchat: string
  emailFooterTiktok: string
  emailFooterLinkedin: string
  emailFooterYoutube: string
}

const DEFAULTS: LayoutState = {
  emailHeaderShowLogo: true,
  emailHeaderShowName: true,
  emailFooterPhone: "",
  emailFooterWebsite: "",
  emailFooterInstagram: "",
  emailFooterTwitter: "",
  emailFooterSnapchat: "",
  emailFooterTiktok: "",
  emailFooterLinkedin: "",
  emailFooterYoutube: "",
}

function SocialField({ label, value, onChange, placeholder }: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder: string
}) {
  return (
    <div className="flex items-center gap-3">
      <Label className="w-28 text-sm shrink-0">{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        dir="ltr"
        className="flex-1"
      />
    </div>
  )
}

export function EmailLayoutForm({ onCancel }: { onCancel: () => void }) {
  const { t } = useLocale()
  const { data: settings, isLoading } = useOrganizationSettings()
  const updateSettings = useUpdateOrganizationSettings()

  const [state, setState] = useState<LayoutState>(DEFAULTS)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (settings && !initialized) {
      // One-time init of editable form state from async-loaded server data.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState({
        emailHeaderShowLogo: settings.emailHeaderShowLogo ?? true,
        emailHeaderShowName: settings.emailHeaderShowName ?? true,
        emailFooterPhone: settings.emailFooterPhone ?? "",
        emailFooterWebsite: settings.emailFooterWebsite ?? "",
        emailFooterInstagram: settings.emailFooterInstagram ?? "",
        emailFooterTwitter: settings.emailFooterTwitter ?? "",
        emailFooterSnapchat: settings.emailFooterSnapchat ?? "",
        emailFooterTiktok: settings.emailFooterTiktok ?? "",
        emailFooterLinkedin: settings.emailFooterLinkedin ?? "",
        emailFooterYoutube: settings.emailFooterYoutube ?? "",
      })
      setInitialized(true)
    }
  }, [settings, initialized])

  const setField = <K extends keyof LayoutState>(key: K, value: LayoutState[K]) => {
    setState((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = () => {
    updateSettings.mutate(
      {
        emailHeaderShowLogo: state.emailHeaderShowLogo,
        emailHeaderShowName: state.emailHeaderShowName,
        emailFooterPhone: state.emailFooterPhone || null,
        emailFooterWebsite: state.emailFooterWebsite || null,
        emailFooterInstagram: state.emailFooterInstagram || null,
        emailFooterTwitter: state.emailFooterTwitter || null,
        emailFooterSnapchat: state.emailFooterSnapchat || null,
        emailFooterTiktok: state.emailFooterTiktok || null,
        emailFooterLinkedin: state.emailFooterLinkedin || null,
        emailFooterYoutube: state.emailFooterYoutube || null,
      },
      {
        onSuccess: () => toast.success(t("settings.emailLayout.saved")),
        onError: () => toast.error(t("settings.error")),
      },
    )
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 h-full overflow-y-auto">
      <p className="text-sm font-semibold text-foreground">
        {t("settings.emailLayout.title")}
      </p>
      <p className="text-xs text-muted-foreground -mt-2">
        {t("settings.emailLayout.description")}
      </p>

      <Card className="shadow-sm bg-surface">
        <CardContent className="pt-4 pb-4 space-y-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {t("settings.emailLayout.header")}
          </p>
          <div className="flex items-center justify-between">
            <Label>{t("settings.emailLayout.showLogo")}</Label>
            <Switch
              checked={state.emailHeaderShowLogo}
              onCheckedChange={(v) => setField("emailHeaderShowLogo", v)}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>{t("settings.emailLayout.showName")}</Label>
            <Switch
              checked={state.emailHeaderShowName}
              onCheckedChange={(v) => setField("emailHeaderShowName", v)}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm bg-surface">
        <CardContent className="pt-4 pb-4 space-y-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {t("settings.emailLayout.footer")}
          </p>
          <SocialField
            label={t("settings.emailLayout.phone")}
            value={state.emailFooterPhone}
            onChange={(v) => setField("emailFooterPhone", v)}
            placeholder="+966500000000"
          />
          <SocialField
            label={t("settings.emailLayout.website")}
            value={state.emailFooterWebsite}
            onChange={(v) => setField("emailFooterWebsite", v)}
            placeholder="https://clinic.com"
          />
          <SocialField
            label={t("settings.emailLayout.instagram")}
            value={state.emailFooterInstagram}
            onChange={(v) => setField("emailFooterInstagram", v)}
            placeholder="https://instagram.com/clinic"
          />
          <SocialField
            label={t("settings.emailLayout.twitter")}
            value={state.emailFooterTwitter}
            onChange={(v) => setField("emailFooterTwitter", v)}
            placeholder="https://x.com/clinic"
          />
          <SocialField
            label={t("settings.emailLayout.snapchat")}
            value={state.emailFooterSnapchat}
            onChange={(v) => setField("emailFooterSnapchat", v)}
            placeholder="https://snapchat.com/add/clinic"
          />
          <SocialField
            label={t("settings.emailLayout.tiktok")}
            value={state.emailFooterTiktok}
            onChange={(v) => setField("emailFooterTiktok", v)}
            placeholder="https://tiktok.com/@clinic"
          />
          <SocialField
            label={t("settings.emailLayout.linkedin")}
            value={state.emailFooterLinkedin}
            onChange={(v) => setField("emailFooterLinkedin", v)}
            placeholder="https://linkedin.com/company/clinic"
          />
          <SocialField
            label={t("settings.emailLayout.youtube")}
            value={state.emailFooterYoutube}
            onChange={(v) => setField("emailFooterYoutube", v)}
            placeholder="https://youtube.com/@clinic"
          />
        </CardContent>
      </Card>

      <div className="flex items-center justify-between mt-auto pt-2">
        <Button variant="outline" size="sm" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button size="sm" onClick={handleSave} disabled={updateSettings.isPending}>
          {updateSettings.isPending ? t("common.saving") : t("settings.save")}
        </Button>
      </div>
    </div>
  )
}
