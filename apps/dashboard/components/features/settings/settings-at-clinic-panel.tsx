"use client"

import { Card, CardContent, Switch } from "@sawaa/ui"
import { toast } from "sonner"
import { useLocale } from "@/components/locale-provider"
import { useBookingSettings, useBookingSettingsMutation, usePaymentSettings } from "@/hooks/use-organization-settings"
import { toastApiError } from "@/lib/mutation-helpers"
import { PaymentMethodsToggles } from "./payment-methods-toggles"

export function SettingsAtClinicPanel() {
  const { t } = useLocale()
  const { data: paymentSettings } = usePaymentSettings()
  const { data: bookingSettings } = useBookingSettings()
  const bookingMut = useBookingSettingsMutation()

  // Client-surface switch: hides pay-at-center from the website and the app
  // only. Reception keeps the org-level capability, so its booking screen is
  // never blocked by this toggle.
  const clientPayAtClinic = bookingSettings?.payAtClinicEnabled ?? false
  const clientPayAtClinicAvailable = (paymentSettings?.paymentAtClinicEnabled ?? false) && clientPayAtClinic
  const toggleClientPayAtClinic = (value: boolean) => {
    bookingMut.mutate(
      { payAtClinicEnabled: value },
      {
        onSuccess: () => toast.success(t("settings.saved")),
        onError: toastApiError(t("settings.error"), t),
      },
    )
  }

  return (
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
          <div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${clientPayAtClinicAvailable ? "bg-success" : "bg-muted-foreground"}`} />
          <div>
            <p className="text-sm font-medium text-foreground">
              {clientPayAtClinicAvailable
                ? t("settings.payment.atClinicClientOn")
                : t("settings.payment.atClinicClientOff")}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">{t("settings.payment.atClinicToggleHint")}</p>
          </div>
        </CardContent>
      </Card>
    </div>

    <div className="mt-1 flex items-start justify-between gap-4 rounded-md border border-border bg-surface p-3">
      <div>
        <p className="text-sm font-medium text-foreground">
          {t("settings.payment.clientAtClinic.title")}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {t("settings.payment.clientAtClinic.description")}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("settings.payment.clientAtClinic.receptionNote")}
        </p>
      </div>
      <Switch
        checked={clientPayAtClinic}
        onCheckedChange={toggleClientPayAtClinic}
        disabled={bookingMut.isPending}
        aria-label={t("settings.payment.clientAtClinic.title")}
      />
    </div>

    <div className="mt-1">
      <p className="text-sm font-medium text-foreground">{t("settings.payment.atClinicMethods")}</p>
      <p className="mt-0.5 mb-2 text-xs text-muted-foreground">{t("settings.payment.atClinicMethodsDesc")}</p>
      <PaymentMethodsToggles />
    </div>
  </div>
  )
}
