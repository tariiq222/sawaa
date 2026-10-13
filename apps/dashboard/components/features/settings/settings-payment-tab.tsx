"use client"

import { useState } from "react"
import { Card, Switch, Skeleton } from "@sawaa/ui"
import { useLocale } from "@/components/locale-provider"
import { useAuth } from "@/components/providers/auth-provider"
import { usePaymentSettings, usePaymentSettingsMutation } from "@/hooks/use-organization-settings"
import { toastApiError } from "@/lib/mutation-helpers"
import { SettingsTabSidebar } from "./settings-tab-sidebar"
import { SettingsAtClinicPanel } from "./settings-at-clinic-panel"
import { BankTransferAccountsPanel } from "./bank-transfer-accounts-panel"
import { SettingsMoyasarPanel } from "./settings-moyasar-panel"

type TabId = "moyasar" | "atclinic" | "bankTransfer"

export function SettingsPaymentTab() {
  const { canDo } = useAuth()
  if (canDo("setting", "read")) return <PaymentMethodsSettings />
  return canDo("providerconfig", "read") ? <SettingsMoyasarPanel /> : null
}

function PaymentMethodsSettings() {
  const { t } = useLocale()
  const { canDo } = useAuth()
  const canUpdate = canDo("setting", "update")
  const canReadProvider = canDo("providerconfig", "read")
  const { data: paymentSettings, isLoading } = usePaymentSettings()
  const paymentMut = usePaymentSettingsMutation()
  const [activeTab, setActiveTab] = useState<TabId>(canReadProvider ? "moyasar" : "atclinic")
  const togglePaymentMethod = (key: "paymentMoyasarEnabled" | "paymentAtClinicEnabled", value: boolean) => {
    if (!canUpdate) return
    paymentMut.mutate({ [key]: value }, { onError: toastApiError(t("settings.error"), t) })
  }
  if (isLoading) return <Skeleton className="h-48 rounded-lg" />
  const tabs = [
    { id: "moyasar", label: t("settings.booking.paymentMethods.moyasar"), desc: t("settings.booking.paymentMethods.moyasarDesc"),
      enabled: paymentSettings?.paymentMoyasarEnabled ?? false, toggle: (value: boolean) => togglePaymentMethod("paymentMoyasarEnabled", value) },
    { id: "atclinic", label: t("settings.booking.paymentMethods.atClinic"), desc: t("settings.booking.paymentMethods.atClinicDesc"),
      enabled: paymentSettings?.paymentAtClinicEnabled ?? false, toggle: (value: boolean) => togglePaymentMethod("paymentAtClinicEnabled", value) },
    { id: "bankTransfer", label: t("settings.payment.bankTransfer.title"), desc: t("settings.payment.bankTransfer.description"), enabled: true, toggle: null },
  ]
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex min-h-[420px]">
        <SettingsTabSidebar title={t("settings.payment.methods")}
          items={tabs.map((tab) => ({ id: tab.id, label: tab.label, desc: tab.desc,
            extra: tab.toggle ? <Switch checked={tab.enabled} onCheckedChange={tab.toggle} disabled={!canUpdate || paymentMut.isPending}
              aria-label={tab.label} title={tab.id === "atclinic" ? t("settings.payment.atClinicToggleHint") : undefined} /> : null,
          }))}
          activeId={activeTab} onSelect={(id) => setActiveTab(id as TabId)} />
        <div className="flex-1 p-6">
          {activeTab === "moyasar" && (canReadProvider ? <SettingsMoyasarPanel /> : <p className="text-sm text-muted-foreground">{t("common.noPermission")}</p>)}
          {activeTab === "atclinic" && <fieldset disabled={!canUpdate}><SettingsAtClinicPanel /></fieldset>}
          {activeTab === "bankTransfer" && <fieldset disabled={!canUpdate}><BankTransferAccountsPanel /></fieldset>}
        </div>
      </div>
    </Card>
  )
}
