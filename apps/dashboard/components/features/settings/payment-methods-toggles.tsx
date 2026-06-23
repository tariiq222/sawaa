"use client"

import { toast } from "sonner"
import { Card, CardContent, Switch, Skeleton } from "@sawaa/ui"
import { useLocale } from "@/components/locale-provider"
import { usePaymentSettings, usePaymentSettingsMutation } from "@/hooks/use-organization-settings"
import type { PaymentSettings } from "@/lib/api/organization-settings"
import { toastApiError } from "@/lib/mutation-helpers"

type MethodKey = "payMethodCashEnabled" | "payMethodBankEnabled" | "payMethodMadaEnabled" | "payMethodTabbyEnabled"

const METHODS: { key: MethodKey; labelKey: string; descKey: string }[] = [
  { key: "payMethodCashEnabled", labelKey: "settings.payMethods.cash", descKey: "settings.payMethods.cashDesc" },
  { key: "payMethodBankEnabled", labelKey: "settings.payMethods.bank", descKey: "settings.payMethods.bankDesc" },
  { key: "payMethodMadaEnabled", labelKey: "settings.payMethods.mada", descKey: "settings.payMethods.madaDesc" },
  { key: "payMethodTabbyEnabled", labelKey: "settings.payMethods.tabby", descKey: "settings.payMethods.tabbyDesc" },
]

export function PaymentMethodsToggles() {
  const { t } = useLocale()
  const { data: settings, isLoading } = usePaymentSettings()
  const mut = usePaymentSettingsMutation()

  const toggle = (key: MethodKey, value: boolean) => {
    mut.mutate(
      { [key]: value } as Partial<PaymentSettings>,
      { onError: toastApiError(t("settings.error"), t) },
    )
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-2 p-4">
          {METHODS.map((m) => <Skeleton key={m.key} className="h-12 w-full" />)}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="flex flex-col divide-y divide-border p-4">
        {METHODS.map((m) => (
          <div key={m.key} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{t(m.labelKey)}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{t(m.descKey)}</p>
            </div>
            <Switch
              checked={settings?.[m.key] ?? false}
              onCheckedChange={(v) => toggle(m.key, v)}
              disabled={mut.isPending}
              aria-label={t(m.labelKey)}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
