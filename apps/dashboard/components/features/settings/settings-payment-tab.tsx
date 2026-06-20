"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Card, CardContent, Button, Input, Label, Skeleton, Switch } from "@sawaa/ui"
import { useLocale } from "@/components/locale-provider"
import { SettingsTabSidebar } from "./settings-tab-sidebar"
import { PaymentMethodsToggles } from "./payment-methods-toggles"
import { usePaymentSettings, usePaymentSettingsMutation } from "@/hooks/use-organization-settings"
import {
  useMoyasarConfig,
  useTestMoyasarConfig,
  useUpsertMoyasarConfig,
} from "@/hooks/use-moyasar-config"
import type { UpsertMoyasarConfigPayload } from "@/lib/api/moyasar-config"

type TabId = "moyasar" | "atclinic"

export function SettingsPaymentTab() {
  const { t } = useLocale()
  const { data: paymentSettings, isLoading: paymentLoading } = usePaymentSettings()
  const { data: moyasarConfig, isLoading: moyasarLoading } = useMoyasarConfig()
  const paymentMut = usePaymentSettingsMutation()
  const upsertMoyasar = useUpsertMoyasarConfig()
  const testMoyasar = useTestMoyasarConfig()

  const [activeTab, setActiveTab] = useState<TabId>("moyasar")
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

  const togglePaymentMethod = (key: "paymentMoyasarEnabled" | "paymentAtClinicEnabled", value: boolean) => {
    paymentMut.mutate(
      { [key]: value },
      { onSuccess: () => toast.success(t("settings.saved")), onError: (err: Error) => toast.error(err.message) },
    )
  }

  const handleSaveMoyasar = () => {
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
      onError: (err: Error) => toast.error(err.message),
    })
  }

  const handleTestMoyasar = () => {
    testMoyasar.mutate(undefined, {
      onSuccess: (result) => {
        toast[result.ok ? "success" : "error"](
          result.ok ? t("settings.moyasar.testOk") : `${t("settings.moyasar.testFailed")}: ${result.status}`,
        )
      },
      onError: (err: Error) => toast.error(err.message),
    })
  }

  if (paymentLoading || moyasarLoading) {
    return (
      <div className="flex gap-0 overflow-hidden rounded-xl border border-border">
        <div className="w-64 space-y-1 border-e border-border bg-surface-muted p-2">
          {[1, 2].map((i) => <Skeleton key={`skeleton-${i}`} className="h-14 rounded-lg" />)}
        </div>
        <div className="flex-1 p-6"><Skeleton className="h-48 rounded-lg" /></div>
      </div>
    )
  }

  const tabs: {
    id: TabId
    label: string
    desc: string
    enabled: boolean
    onToggle: (v: boolean) => void
    alwaysAvailable?: boolean
    toggleHint?: string
  }[] = [
    {
      id: "moyasar",
      label: t("settings.booking.paymentMethods.moyasar"),
      desc: t("settings.booking.paymentMethods.moyasarDesc"),
      enabled: paymentSettings?.paymentMoyasarEnabled ?? false,
      onToggle: (v) => togglePaymentMethod("paymentMoyasarEnabled", v),
    },
    {
      id: "atclinic",
      label: t("settings.booking.paymentMethods.atClinic"),
      desc: t("settings.booking.paymentMethods.atClinicDesc"),
      enabled: paymentSettings?.paymentAtClinicEnabled ?? false,
      onToggle: (v) => togglePaymentMethod("paymentAtClinicEnabled", v),
      alwaysAvailable: true,
      toggleHint: t("settings.payment.atClinicToggleHint"),
    },
  ]

  const activeTabDef = tabs.find((tab) => tab.id === activeTab)!
  const canSaveMoyasar = publishableKey.trim().length > 0 &&
    (secretKey.trim().length > 0 || !!moyasarConfig?.secretKeyMasked) &&
    (webhookSecret.trim().length > 0 || !!moyasarConfig?.hasWebhookSecret)

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex min-h-[420px]">
        <SettingsTabSidebar
          title={t("settings.payment.methods")}
          items={tabs.map(tab => ({
            id: tab.id,
            label: tab.label,
            desc: tab.desc,
            extra: (
              <Switch
                checked={tab.enabled}
                onCheckedChange={tab.onToggle}
                disabled={paymentMut.isPending}
                title={tab.toggleHint}
              />
            ),
          }))}
          activeId={activeTab}
          onSelect={(id) => setActiveTab(id as TabId)}
        />

        <div className="flex-1 p-6">
          {!activeTabDef.enabled && !activeTabDef.alwaysAvailable ? (
            <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-3 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface-muted">
                <Switch checked={false} disabled className="pointer-events-none scale-75" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{activeTabDef.label}</p>
                <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                  {t("settings.payment.disabledHint")}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => activeTabDef.onToggle(true)}
                disabled={paymentMut.isPending}
              >
                {t("settings.payment.enable")}
              </Button>
            </div>
          ) : (
            <>
              {activeTab === "moyasar" && (
                <div className="flex h-full flex-col gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Card className="bg-surface shadow-sm">
                      <CardContent className="space-y-2 pt-3 pb-3">
                        <Label>{t("settings.moyasarKey")}</Label>
                        <Input value={publishableKey} onChange={(e) => setPublishableKey(e.target.value)} placeholder="pk_live_..." dir="ltr" />
                      </CardContent>
                    </Card>
                    <Card className="bg-surface shadow-sm">
                      <CardContent className="space-y-2 pt-3 pb-3">
                        <Label>{t("settings.moyasarSecret")}</Label>
                        <Input value={secretKey} onChange={(e) => setSecretKey(e.target.value)} placeholder={moyasarConfig?.secretKeyMasked ?? "sk_live_..."} type="password" dir="ltr" />
                      </CardContent>
                    </Card>
                    <Card className="bg-surface shadow-sm">
                      <CardContent className="space-y-2 pt-3 pb-3">
                        <Label>{t("settings.moyasar.webhookSecret")}</Label>
                        <Input value={webhookSecret} onChange={(e) => setWebhookSecret(e.target.value)} placeholder={moyasarConfig?.hasWebhookSecret ? "............" : "whsec_..."} type="password" dir="ltr" />
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
                    <Button size="sm" variant="outline" disabled={!moyasarConfig || testMoyasar.isPending} onClick={handleTestMoyasar}>
                      {t("settings.moyasar.test")}
                    </Button>
                    <Button size="sm" disabled={!canSaveMoyasar || upsertMoyasar.isPending} onClick={handleSaveMoyasar}>
                      {t("settings.save")}
                    </Button>
                  </div>
                </div>
              )}

              {activeTab === "atclinic" && (
                <div className="flex h-full flex-col gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Card className="border-success/20 bg-success/5 shadow-sm">
                      <CardContent className="flex items-start gap-3 pt-3 pb-3">
                        <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-success" />
                        <div>
                          <p className="text-sm font-medium text-success">{t("settings.payment.atClinicAlwaysOn")}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{t("settings.payment.atClinicAlwaysOnDesc")}</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-surface shadow-sm">
                      <CardContent className="flex items-start gap-3 pt-3 pb-3">
                        <div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${(paymentSettings?.paymentAtClinicEnabled ?? false) ? "bg-success" : "bg-muted-foreground"}`} />
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {(paymentSettings?.paymentAtClinicEnabled ?? false)
                              ? t("settings.payment.atClinicClientOn")
                              : t("settings.payment.atClinicClientOff")}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{t("settings.payment.atClinicToggleHint")}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="mt-1">
                    <p className="text-sm font-medium text-foreground">{t("settings.payment.atClinicMethods")}</p>
                    <p className="mt-0.5 mb-2 text-xs text-muted-foreground">{t("settings.payment.atClinicMethodsDesc")}</p>
                    <PaymentMethodsToggles />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Card>
  )
}
