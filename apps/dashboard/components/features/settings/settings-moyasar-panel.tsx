"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Card, CardContent, Button, Input, Label, Skeleton, Switch } from "@sawaa/ui"
import { useLocale } from "@/components/locale-provider"
import { useAuth } from "@/components/providers/auth-provider"
import { useMoyasarConfig, useTestMoyasarConfig, useUpsertMoyasarConfig } from "@/hooks/use-moyasar-config"
import type { UpsertMoyasarConfigPayload } from "@/lib/api/moyasar-config"
import { toastApiError } from "@/lib/mutation-helpers"

export function SettingsMoyasarPanel() {
  const { canDo } = useAuth()
  return canDo("providerconfig", "read") ? <MoyasarConfiguration /> : null
}

function MoyasarConfiguration() {
  const { t } = useLocale()
  const { canDo } = useAuth()
  const canManage = canDo("providerconfig", "manage")
  const { data: moyasarConfig, isLoading } = useMoyasarConfig()
  const upsertMoyasar = useUpsertMoyasarConfig()
  const testMoyasar = useTestMoyasarConfig()
  const [publishableKey, setPublishableKey] = useState("")
  const [secretKey, setSecretKey] = useState("")
  const [webhookSecret, setWebhookSecret] = useState("")
  const [isLive, setIsLive] = useState(false)

  useEffect(() => {
    if (!moyasarConfig) return
    // Seed editable form fields from server settings; user edits locally and saves explicitly.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPublishableKey(moyasarConfig.publishableKey)
    setIsLive(moyasarConfig.isLive)
  }, [moyasarConfig])

  const handleSaveMoyasar = () => {
    if (!canManage) return
    const pubChanged = publishableKey.trim() !== (moyasarConfig?.publishableKey ?? "")
    const secretEntered = secretKey.trim().length > 0
    const webhookEntered = webhookSecret.trim().length > 0
    // Atomic rotation guard: if the user is rotating *any* credential,
    // require them to re-enter *all* three together. Partial rotation can
    // desync webhook verification (new pk, old secret/webhook → 401 on next
    // webhook call). All-or-nothing for credential changes.
    const anyChanged = pubChanged || secretEntered || webhookEntered
    const allProvided = pubChanged && secretEntered && webhookEntered
    if (anyChanged && !allProvided) {
      toast.error(t("settings.moyasar.rotateAllOrNone"))
      return
    }

    const payload: UpsertMoyasarConfigPayload = {
      publishableKey: publishableKey.trim(),
      isLive,
    }
    if (secretEntered) payload.secretKey = secretKey.trim()
    if (webhookEntered) payload.webhookSecret = webhookSecret.trim()

    upsertMoyasar.mutate(payload, {
      onSuccess: () => {
        toast.success(t("settings.saved"))
        setSecretKey("")
        setWebhookSecret("")
      },
      onError: toastApiError(t("settings.error"), t),
    })
  }

  const handleTestMoyasar = () => {
    if (!canManage) return
    testMoyasar.mutate(undefined, {
      onSuccess: (result) => {
        toast[result.ok ? "success" : "error"](
          result.ok ? t("settings.moyasar.testOk") : `${t("settings.moyasar.testFailed")}: ${result.status}`,
        )
      },
      onError: toastApiError(t("settings.error"), t),
    })
  }

  const canSaveMoyasar = publishableKey.trim().length > 0 &&
    (secretKey.trim().length > 0 || !!moyasarConfig?.secretKeyMasked) &&
    (webhookSecret.trim().length > 0 || !!moyasarConfig?.hasWebhookSecret)

  if (isLoading) return <Skeleton className="h-48 rounded-lg" />
  return (
    <fieldset disabled={!canManage} className="flex h-full flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-surface shadow-sm">
          <CardContent className="space-y-2 pt-3 pb-3">
            <Label htmlFor="settings-moyasar-publishable-key">{t("settings.moyasarKey")}</Label>
            <Input id="settings-moyasar-publishable-key" value={publishableKey} onChange={(e) => setPublishableKey(e.target.value)} placeholder="pk_live_..." dir="ltr" />
          </CardContent>
        </Card>
        <Card className="bg-surface shadow-sm">
          <CardContent className="space-y-2 pt-3 pb-3">
            <Label htmlFor="settings-moyasar-secret-key">{t("settings.moyasarSecret")}</Label>
            <Input id="settings-moyasar-secret-key" value={secretKey} onChange={(e) => setSecretKey(e.target.value)} placeholder={moyasarConfig?.secretKeyMasked ?? "sk_live_..."} type="password" dir="ltr" />
          </CardContent>
        </Card>
        <Card className="bg-surface shadow-sm">
          <CardContent className="space-y-2 pt-3 pb-3">
            <Label htmlFor="settings-moyasar-webhook-secret">{t("settings.moyasar.webhookSecret")}</Label>
            <Input id="settings-moyasar-webhook-secret" value={webhookSecret} onChange={(e) => setWebhookSecret(e.target.value)} placeholder={moyasarConfig?.hasWebhookSecret ? "............" : "whsec_..."} type="password" dir="ltr" />
            <p className="text-xs text-muted-foreground">{t("settings.moyasar.webhookSecretRequired")}</p>
          </CardContent>
        </Card>
        <Card className="bg-surface shadow-sm">
          <CardContent className="flex items-center justify-between gap-4 pt-3 pb-3">
            <div>
              <p className="text-sm font-medium text-foreground">{t("settings.moyasar.liveMode")}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{t("settings.moyasar.liveModeDesc")}</p>
            </div>
            <Switch checked={isLive} onCheckedChange={setIsLive} />
          </CardContent>
        </Card>
      </div>
      {moyasarConfig && (
        <p className="text-xs text-muted-foreground">
          {t("settings.moyasar.lastStatus")}: {moyasarConfig.lastVerifiedStatus ?? "—"}
        </p>
      )}
      <div className="mt-auto flex justify-end gap-2 pt-2">
        <Button size="sm" variant="outline" disabled={!canManage || !moyasarConfig || testMoyasar.isPending} onClick={handleTestMoyasar}>
          {t("settings.moyasar.test")}
        </Button>
        <Button size="sm" disabled={!canManage || !canSaveMoyasar || upsertMoyasar.isPending} onClick={handleSaveMoyasar}>
          {t("settings.save")}
        </Button>
      </div>
    </fieldset>
  )
}
