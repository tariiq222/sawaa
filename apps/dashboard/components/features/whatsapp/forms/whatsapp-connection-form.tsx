"use client"

import { useEffect, useRef, useState } from "react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Label,
  Switch,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@sawaa/ui"
import { useLocale } from "@/components/locale-provider"
import { useWhatsappConfig } from "@/hooks/use-whatsapp"
import {
  useTestWhatsappConfig,
  useUpsertWhatsappConfig,
} from "@/hooks/use-whatsapp-mutations"
import type { WhatsappProviderName } from "@/lib/types/whatsapp"

const PROVIDERS: { value: WhatsappProviderName; key: string }[] = [
  { value: "EVOLUTION_API", key: "whatsapp.connection.provider.evolutionApi" },
]

export function WhatsappConnectionForm() {
  const { t } = useLocale()
  const { config, loading } = useWhatsappConfig()
  const upsert = useUpsertWhatsappConfig()
  const test = useTestWhatsappConfig()
  const [provider, setProvider] = useState<WhatsappProviderName>("EVOLUTION_API")
  const [baseUrl, setBaseUrl] = useState("")
  const [instanceName, setInstanceName] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [webhookSecret, setWebhookSecret] = useState("")
  const [isActive, setIsActive] = useState(true)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const seeded = useRef(false)

  useEffect(() => {
    if (!config || seeded.current) return
    seeded.current = true
    setProvider((config.provider as WhatsappProviderName) ?? "EVOLUTION_API")
    setBaseUrl(config.evolutionBaseUrl ?? "")
    setInstanceName(config.evolutionInstanceName ?? "")
    setIsActive(config.isActive ?? true)
  }, [config])

  const onSave = async () => {
    setNotice(null)
    setError(null)
    try {
      const input: {
        provider: WhatsappProviderName
        evolutionBaseUrl?: string
        evolutionInstanceName?: string
        evolutionApiKey?: string
        webhookSecret?: string
        isActive?: boolean
      } = {
        provider,
        isActive,
      }
      if (baseUrl.trim()) input.evolutionBaseUrl = baseUrl.trim()
      if (instanceName.trim()) input.evolutionInstanceName = instanceName.trim()
      if (apiKey.trim()) input.evolutionApiKey = apiKey.trim()
      if (webhookSecret.trim()) input.webhookSecret = webhookSecret.trim()
      const result = await upsert.mutateAsync(input)
      setNotice(t("whatsapp.connection.saved"))
      setApiKey("")
      setWebhookSecret("")
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
        setError(t("whatsapp.connection.testFailed").replace("{error}", result.error ?? "Unknown"))
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Test failed")
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
    <Card>
      <CardHeader>
        <CardTitle>{t("whatsapp.connection.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="wa-provider">{t("whatsapp.connection.provider")}</Label>
            <Select
              value={provider}
              onValueChange={(v) => setProvider(v as WhatsappProviderName)}
            >
              <SelectTrigger id="wa-provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROVIDERS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {t(p.key)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t("whatsapp.connection.providerHint")}
            </p>
          </div>

          {provider === "EVOLUTION_API" && (
            <div className="space-y-2">
              <Label htmlFor="wa-baseUrl">Evolution API Base URL</Label>
              <Input
                id="wa-baseUrl"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://evolution.example.com"
              />
            </div>
          )}
        </div>

        {provider === "EVOLUTION_API" && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="wa-instance">Instance Name</Label>
              <Input
                id="wa-instance"
                value={instanceName}
                onChange={(e) => setInstanceName(e.target.value)}
                placeholder="sawaa-main"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wa-key">{t("whatsapp.connection.accessToken")}</Label>
              <Input
                id="wa-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="********"
              />
              <p className="text-xs text-muted-foreground">
                {t("whatsapp.connection.accessTokenHint")}
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="wa-webhook">
              {t("whatsapp.connection.webhookSecret")}
            </Label>
            <Input
              id="wa-webhook"
              type="password"
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              placeholder="optional"
            />
          </div>
          <div className="flex items-end gap-3">
            <Switch
              id="wa-active"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
            <Label htmlFor="wa-active">{t("whatsapp.connection.isActive")}</Label>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={onSave} disabled={upsert.isPending}>
            {t("whatsapp.connection.save")}
          </Button>
          <Button
            variant="outline"
            onClick={onTest}
            disabled={test.isPending}
          >
            {t("whatsapp.connection.test")}
          </Button>
          {notice && (
            <span className="text-xs text-success">{notice}</span>
          )}
          {error && (
            <span className="text-xs text-error">{error}</span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
