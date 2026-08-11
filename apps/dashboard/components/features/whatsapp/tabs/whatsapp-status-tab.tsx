"use client"

import { Button, Card, CardContent, CardHeader, CardTitle } from "@sawaa/ui"
import { useLocale } from "@/components/locale-provider"
import {
  useWhatsappConfig,
  useWhatsappStatus,
} from "@/hooks/use-whatsapp"
import { useWhatsappControl } from "@/hooks/use-whatsapp-mutations"
import { WhatsappQrDisplay } from "../shared/whatsapp-qr-display"

function formatUptime(seconds: number | null, t: (key: string) => string) {
  if (seconds === null) return "—"
  if (seconds < 60) return t("whatsapp.status.uptime.seconds").replace("{n}", String(seconds))
  if (seconds < 3600) {
    return t("whatsapp.status.uptime.minutes").replace("{n}", String(Math.floor(seconds / 60)))
  }
  if (seconds < 86400) {
    return t("whatsapp.status.uptime.hours").replace("{n}", String(Math.floor(seconds / 3600)))
  }
  return t("whatsapp.status.uptime.days").replace("{n}", String(Math.floor(seconds / 86400)))
}

export function WhatsappStatusTab() {
  const { t } = useLocale()
  const { config } = useWhatsappConfig()
  const { status } = useWhatsappStatus()
  const control = useWhatsappControl()

  const isConnected = status?.isConnected ?? false
  const configured = config?.configured ?? false
  const ready = configured

  const statusKey = isConnected
    ? "whatsapp.status.connected"
    : configured
    ? "whatsapp.status.disconnected"
    : "whatsapp.status.notConfigured"

  const dotColor = isConnected
    ? "bg-success"
    : configured
    ? "bg-warning"
    : "bg-muted-foreground"

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${dotColor}`} />
            {t(statusKey)}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid grid-cols-2 gap-y-3 text-sm">
            <dt className="text-muted-foreground">{t("whatsapp.status.metadata.provider")}</dt>
            <dd className="font-mono">{status?.provider ?? config?.provider ?? "—"}</dd>

            <dt className="text-muted-foreground">{t("whatsapp.status.metadata.phone")}</dt>
            <dd className="font-mono">{status?.connectedPhone ?? config?.connectedPhone ?? "—"}</dd>

            <dt className="text-muted-foreground">{t("whatsapp.status.metadata.uptime")}</dt>
            <dd>{formatUptime(status?.uptimeSeconds ?? null, t)}</dd>

            <dt className="text-muted-foreground">{t("whatsapp.status.metadata.messagesToday")}</dt>
            <dd className="tabular-nums">{status?.messagesCount ?? 0}</dd>

            <dt className="text-muted-foreground">{t("whatsapp.status.metadata.activeChats")}</dt>
            <dd className="tabular-nums">{status?.activeChatCount ?? 0}</dd>

            {status?.lastErrorMessage && (
              <>
                <dt className="text-muted-foreground">{t("whatsapp.status.metadata.lastError")}</dt>
                <dd className="text-error">{status.lastErrorMessage}</dd>
              </>
            )}
          </dl>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              onClick={() => control.mutate({ action: "start" })}
              disabled={control.isPending || !ready}
              variant={isConnected ? "outline" : "default"}
            >
              {t("whatsapp.status.actions.start")}
            </Button>
            <Button
              onClick={() => control.mutate({ action: "stop" })}
              disabled={control.isPending || !isConnected}
              variant="outline"
            >
              {t("whatsapp.status.actions.stop")}
            </Button>
            <Button
              onClick={() => control.mutate({ action: "restart" })}
              disabled={control.isPending || !ready}
              variant="outline"
            >
              {t("whatsapp.status.actions.restart")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("whatsapp.qr.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <WhatsappQrDisplay />
        </CardContent>
      </Card>
    </div>
  )
}
