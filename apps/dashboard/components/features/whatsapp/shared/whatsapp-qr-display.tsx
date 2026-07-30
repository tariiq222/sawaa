"use client"

import { Button } from "@sawaa/ui"
import { useLocale } from "@/components/locale-provider"
import { useWhatsappQr } from "@/hooks/use-whatsapp"

export function WhatsappQrDisplay() {
  const { t } = useLocale()
  const { qr, error, refetch, isFetching } = useWhatsappQr()

  if (error) {
    return (
      <div
        role="alert"
        className="rounded-md border border-error/30 bg-error/5 p-6 text-sm text-error"
      >
        {t("whatsapp.qr.error").replace("{error}", (error as unknown as Error)?.message ?? String(error))}
        <div className="mt-3">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            {t("whatsapp.qr.retry")}
          </Button>
        </div>
      </div>
    )
  }

  if (!qr) {
    return (
      <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
        {t("whatsapp.qr.loading")}
      </div>
    )
  }

  if (qr.status === "not_configured") {
    return (
      <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
        {qr.error ?? t("whatsapp.qr.notConfigured")}
      </div>
    )
  }

  if (qr.status === "connected") {
    return (
      <div className="rounded-md border border-success/30 bg-success/10 p-6 text-sm text-success">
        {t("whatsapp.qr.connected")}
        {qr.connectedPhone ? ` — ${qr.connectedPhone}` : ""}
      </div>
    )
  }

  if (qr.status === "disconnected" && qr.error) {
    return (
      <div
        role="alert"
        className="rounded-md border border-warning/30 bg-warning/5 p-6 text-sm text-warning"
      >
        {t("whatsapp.qr.disconnectedError").replace("{error}", qr.error)}
      </div>
    )
  }

  if (!qr.base64) {
    return (
      <div className="rounded-md border p-6 text-sm text-muted-foreground">
        {t("whatsapp.qr.waiting")}
      </div>
    )
  }

  return (
    <div className="space-y-3 rounded-md border p-6">
      <p className="text-sm text-muted-foreground">{t("whatsapp.qr.hint")}</p>
      <div className="flex justify-center">
        {/* Data URI QR — next/image cannot optimize this. Document the lint
            exception inline rather than disabling the rule globally. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qr.base64}
          alt={t("whatsapp.qr.alt")}
          width={280}
          height={280}
          className="rounded-md border bg-white p-2"
        />
      </div>
      {qr.pairingCode && (
        <p className="text-center text-sm">
          <span className="text-muted-foreground">{t("whatsapp.qr.pairingLabel")} </span>
          <code dir="ltr" className="font-mono text-base">
            {qr.pairingCode}
          </code>
        </p>
      )}
      <div className="flex justify-center">
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          {t("whatsapp.qr.refresh")}
        </Button>
      </div>
    </div>
  )
}
