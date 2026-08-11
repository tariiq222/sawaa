"use client"

import { useState } from "react"
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Switch,
} from "@sawaa/ui"
import { useLocale } from "@/components/locale-provider"
import { useWhatsappConfig, useWhatsappStatus } from "@/hooks/use-whatsapp"
import {
  useTestWhatsappConfig,
  useUnlinkWhatsappConfig,
  useUpsertWhatsappConfig,
} from "@/hooks/use-whatsapp-mutations"
import { WhatsappStatusTab } from "../tabs/whatsapp-status-tab"

export function WhatsappConnectionForm() {
  const { t } = useLocale()
  const { config, loading } = useWhatsappConfig()
  const { status } = useWhatsappStatus()
  const upsert = useUpsertWhatsappConfig()
  const test = useTestWhatsappConfig()
  const unlink = useUnlinkWhatsappConfig()
  const [isActiveOverride, setIsActiveOverride] = useState<boolean>()
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmUnlink, setConfirmUnlink] = useState(false)

  const backendConfigured = config?.configured ?? false
  const isActive = isActiveOverride ?? config?.isActive ?? false
  const isConnected = status?.isConnected ?? false

  const onSave = async () => {
    setNotice(null)
    setError(null)
    try {
      const result = await upsert.mutateAsync({
        provider: "EVOLUTION_API",
        isActive,
      })
      setIsActiveOverride(result.isActive)
      setNotice(t("whatsapp.connection.saved"))
      if (!result.verified) {
        setError(
          t("whatsapp.connection.testFailed").replace(
            "{error}",
            result.verifiedError ?? "Unknown",
          ),
        )
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed")
    }
  }

  const onTest = async () => {
    setError(null)
    setNotice(null)
    try {
      const result = await test.mutateAsync()
      if (result.ok) {
        setNotice(
          t("whatsapp.connection.testOk").replace(
            "{phone}",
            result.phone ?? result.state ?? "?",
          ),
        )
      } else {
        setError(
          t("whatsapp.connection.testFailed").replace(
            "{error}",
            result.error ?? "Unknown",
          ),
        )
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Test failed")
    }
  }

  const onUnlink = async () => {
    if (!isConnected) return
    setConfirmUnlink(false)
    setNotice(null)
    setError(null)
    try {
      const result = await unlink.mutateAsync()
      setIsActiveOverride(false)
      if (result.logoutOk) {
        setNotice(t("whatsapp.connection.unlinkSuccess"))
      } else {
        setError(t("whatsapp.connection.unlinkPartial"))
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unlink failed")
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-muted-foreground">
          {t("whatsapp.connection.title")} — ...
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <WhatsappStatusTab />
      <Card>
        <CardHeader>
          <CardTitle>{t("whatsapp.connection.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
        <section className="space-y-4 rounded-lg border border-border/60 bg-surface-muted/30 p-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {t("whatsapp.connection.section.connection")}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("whatsapp.connection.section.connectionHint")}
            </p>
          </div>

          <div className="space-y-2">
            <Label>{t("whatsapp.connection.provider")}</Label>
            <div className="rounded-md border border-border/60 bg-background/60 px-3 py-2 text-sm">
              {t("whatsapp.connection.provider.evolutionApi")}
            </div>
            <p className="text-xs text-muted-foreground">
              {t("whatsapp.connection.backendManaged")}
            </p>
          </div>

          {!backendConfigured && (
            <div
              className="rounded-md border border-warning/30 bg-warning/5 p-3 text-sm text-warning"
              role="alert"
            >
              {t("whatsapp.connection.backendMissing")}
            </div>
          )}

          <div className="flex items-center gap-3">
            <Switch
              id="wa-active"
              checked={isActive}
              onCheckedChange={setIsActiveOverride}
              disabled={!backendConfigured}
            />
            <Label htmlFor="wa-active">
              {t("whatsapp.connection.isActive")}
            </Label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={onSave}
              disabled={upsert.isPending || !backendConfigured}
            >
              {t("whatsapp.connection.save")}
            </Button>
            <Button
              variant="outline"
              onClick={onTest}
              disabled={test.isPending || !backendConfigured}
            >
              {t("whatsapp.connection.test")}
            </Button>
            {notice && <span className="text-xs text-success">{notice}</span>}
            {error && <span className="text-xs text-error">{error}</span>}
          </div>
        </section>

        {isConnected && (
          <section className="rounded-lg border border-error/30 bg-error-soft/20 p-4">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-foreground">
                {t("whatsapp.connection.section.advanced")}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("whatsapp.connection.section.advancedHint")}
              </p>
            </div>
            <Button
              variant="destructive"
              onClick={() => setConfirmUnlink(true)}
              disabled={unlink.isPending || !backendConfigured}
            >
              {t("whatsapp.connection.unlink")}
            </Button>
          </section>
        )}
        </CardContent>

        <Dialog open={confirmUnlink} onOpenChange={setConfirmUnlink}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("whatsapp.connection.unlinkConfirmTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("whatsapp.connection.unlinkConfirm")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmUnlink(false)}
              disabled={unlink.isPending}
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={onUnlink}
              disabled={unlink.isPending}
            >
              {t("whatsapp.connection.unlink")}
            </Button>
          </DialogFooter>
        </DialogContent>
        </Dialog>
      </Card>
    </div>
  )
}
