"use client"

import { useState } from "react"
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from "@deqah/ui"
import { useLocale } from "@/components/locale-provider"
import {
  useTestZoomConfig,
  useUpsertZoomConfig,
  useZoomConfig,
} from "@/hooks/use-zoom-config"
import type { UpsertZoomConfigInput } from "@/lib/types/zoom"

export function ZoomSettingsForm() {
  const { t } = useLocale()
  const { config, loading } = useZoomConfig()
  const upsert = useUpsertZoomConfig()
  const test = useTestZoomConfig()

  const [clientId, setClientId] = useState<string>("")
  const [clientSecret, setClientSecret] = useState<string>("")
  const [accountId, setAccountId] = useState<string>("")
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  const buildInput = (): UpsertZoomConfigInput => ({
    zoomClientId: clientId.trim(),
    zoomClientSecret: clientSecret.trim(),
    zoomAccountId: accountId.trim(),
  })

  const allFilled = clientId.trim() && clientSecret.trim() && accountId.trim()

  const onSave = async () => {
    if (!allFilled) return
    setStatusMessage(null)
    await upsert.mutateAsync(buildInput())
    setClientId("")
    setClientSecret("")
    setAccountId("")
    setStatusMessage(t("zoom.form.saved"))
  }

  const onTest = async () => {
    if (!allFilled) return
    setStatusMessage(null)
    const result = await test.mutateAsync(buildInput())
    setStatusMessage(
      result.ok
        ? t("zoom.form.testOk")
        : t("zoom.form.testFailed").replace("{error}", result.error ?? ""),
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("zoom.form.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <p className="text-muted-foreground">{t("zoom.form.loading")}</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {t("zoom.form.hint")}
            </p>

            <div className="space-y-2">
              <Label htmlFor="zoom-account-id">
                {t("zoom.form.accountId")}
              </Label>
              <Input
                id="zoom-account-id"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                placeholder="abcDEF1234..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="zoom-client-id">{t("zoom.form.clientId")}</Label>
              <Input
                id="zoom-client-id"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="zoom-client-secret">
                {t("zoom.form.clientSecret")}
              </Label>
              <Input
                id="zoom-client-secret"
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={onSave}
                disabled={upsert.isPending || !allFilled}
              >
                {t("zoom.form.save")}
              </Button>
              <Button
                variant="outline"
                onClick={onTest}
                disabled={test.isPending || !allFilled}
              >
                {t("zoom.form.test")}
              </Button>
              {config?.configured && (
                <span className="text-xs text-success">
                  {t("zoom.form.configured")}
                </span>
              )}
            </div>

            {statusMessage && (
              <p className="text-sm">{statusMessage}</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
