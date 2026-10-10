"use client"

// SaaS-02g-sms — provider picker + credential form for /settings/sms.

import { useEffect, useState, startTransition } from "react"
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@sawaa/ui"
import { useLocale } from "@/components/locale-provider"
import {
  useSmsConfig,
  useTestSms,
  useUpsertSmsConfig,
} from "@/hooks/use-sms-config"
import { toast } from "sonner"
import { buildSmsConfigInput } from "@/lib/sms-config-input"
import type { SmsProvider } from "@/lib/types/sms"

export function SmsSettingsForm() {
  const { locale, t } = useLocale()
  const isAr = locale === "ar"
  const { config, loading, error } = useSmsConfig()
  const upsert = useUpsertSmsConfig()
  const test = useTestSms()

  const [provider, setProvider] = useState<SmsProvider>("NONE")
  const [senderId, setSenderId] = useState<string>("")
  const [appSid, setAppSid] = useState<string>("")
  const [apiKey, setApiKey] = useState<string>("")
  const [apiToken, setApiToken] = useState<string>("")
  const [testPhone, setTestPhone] = useState<string>("")
  const [testMessage, setTestMessage] = useState<string | null>(null)

  useEffect(() => {
    if (config) {
      startTransition(() => {
        setProvider(config.provider)
        setSenderId(config.senderId ?? "")
      })
    }
  }, [config])

  const onSave = async () => {
    try {
      await upsert.mutateAsync(buildSmsConfigInput(provider, senderId, appSid, apiKey, apiToken))
      setAppSid("")
      setApiKey("")
      setApiToken("")
      toast.success(t("sms.form.saved"))
    } catch (err) {
      toast.error(err instanceof Error && err.message === "SMS_CREDENTIALS_REQUIRED" ? t("sms.form.credentialsRequired") : t("sms.form.saveFailed"))
    }
  }

  const onTest = async () => {
    if (!testPhone.trim()) return
    try {
      const result = await test.mutateAsync(testPhone.trim())
      if (result.ok) {
        setTestMessage(t("sms.form.testSent").replace("{id}", result.providerMessageId ?? ""))
        toast.success(t("sms.form.testSent").replace("{id}", result.providerMessageId ?? ""))
      } else {
        const message = result.error ? (isAr ? result.error.ar : result.error.en) : t("sms.form.testFailed")
        setTestMessage(message)
        toast.error(message)
      }
    } catch {
      setTestMessage(t("sms.form.testFailed"))
      toast.error(t("sms.form.testFailed"))
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("sms.form.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {error ? <p role="alert" className="text-destructive">{t("error.server")}</p> : loading ? (
          <p className="text-muted-foreground">{t("sms.form.loading")}</p>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="sms-provider">{t("sms.form.provider")}</Label>
              <Select
                value={provider}
                onValueChange={(v) => setProvider(v as SmsProvider)}
              >
                <SelectTrigger id="sms-provider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">
                    {t("sms.form.providerNone")}
                  </SelectItem>
                  <SelectItem value="UNIFONIC">
                    {t("sms.provider.unifonic")}
                  </SelectItem>
                  <SelectItem value="TAQNYAT">
                    {t("sms.provider.taqnyat")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {provider !== "NONE" && (
              <div className="space-y-2">
                <Label htmlFor="sms-sender">{t("sms.form.senderId")}</Label>
                <Input
                  id="sms-sender"
                  value={senderId}
                  onChange={(e) => setSenderId(e.target.value)}
                  placeholder="Sawaa"
                />
              </div>
            )}

            {provider === "UNIFONIC" && (
              <div className="space-y-3 rounded-md border p-4">
                <p className="text-sm text-muted-foreground">
                  {t("sms.form.credsHint")}
                </p>
                <div className="space-y-2">
                  <Label htmlFor="u-appsid">{t("sms.form.appSid")}</Label>
                  <Input
                    id="u-appsid"
                    value={appSid}
                    onChange={(e) => setAppSid(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="u-apikey">{t("sms.form.apiKey")}</Label>
                  <Input
                    id="u-apikey"
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                </div>
              </div>
            )}

            {provider === "TAQNYAT" && (
              <div className="space-y-3 rounded-md border p-4">
                <p className="text-sm text-muted-foreground">
                  {t("sms.form.credsHint")}
                </p>
                <div className="space-y-2">
                  <Label htmlFor="t-apitoken">{t("sms.form.apiToken")}</Label>
                  <Input
                    id="t-apitoken"
                    type="password"
                    value={apiToken}
                    onChange={(e) => setApiToken(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Button onClick={onSave} disabled={upsert.isPending}>
                {t("sms.form.save")}
              </Button>
              {config?.credentialsConfigured && (
                <span className="text-xs text-success">
                  {t("sms.form.credsSaved")}
                </span>
              )}
            </div>

            {config?.credentialsConfigured && provider !== "NONE" && (
              <div className="space-y-3 rounded-md border p-4">
                <Label htmlFor="test-phone">{t("sms.form.testPhone")}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="test-phone"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    placeholder="+9665..."
                  />
                  <Button
                    variant="outline"
                    onClick={onTest}
                    disabled={test.isPending || !testPhone.trim()}
                  >
                    {t("sms.form.sendTest")}
                  </Button>
                </div>
                {testMessage && <p className="text-sm">{testMessage}</p>}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
