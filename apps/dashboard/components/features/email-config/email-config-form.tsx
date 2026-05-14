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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deqah/ui"
import { useLocale } from "@/components/locale-provider"
import {
  useEmailConfig,
  useUpsertEmailConfig,
  useTestEmail,
} from "@/hooks/use-email-config"
import type { EmailProviderName, UpsertEmailConfigInput } from "@/lib/types/email-config"

const PROVIDERS: { value: EmailProviderName; label: string }[] = [
  { value: "NONE", label: "—" },
  { value: "RESEND", label: "Resend" },
  { value: "SENDGRID", label: "SendGrid" },
  { value: "MAILCHIMP", label: "Mailchimp Transactional" },
  { value: "SMTP", label: "SMTP مخصص" },
]

export function EmailConfigForm() {
  const { t } = useLocale()
  const { config, loading } = useEmailConfig()
  const upsert = useUpsertEmailConfig()
  const testMutation = useTestEmail()

  const [provider, setProvider] = useState<EmailProviderName>("NONE")
  const [senderName, setSenderName] = useState("")
  const [senderEmail, setSenderEmail] = useState("")
  // per-provider credentials
  const [apiKey, setApiKey] = useState("")
  const [smtpHost, setSmtpHost] = useState("")
  const [smtpPort, setSmtpPort] = useState("587")
  const [smtpUser, setSmtpUser] = useState("")
  const [smtpPass, setSmtpPass] = useState("")
  const [testEmail, setTestEmail] = useState("")

  const [statusMessage, setStatusMessage] = useState<{ text: string; ok: boolean } | null>(null)

  const buildInput = (): UpsertEmailConfigInput => {
    const base: UpsertEmailConfigInput = {
      provider,
      senderName: senderName.trim() || undefined,
      senderEmail: senderEmail.trim() || undefined,
    }
    if (provider === "SMTP") {
      base.smtp = {
        host: smtpHost.trim(),
        port: parseInt(smtpPort, 10) || 587,
        user: smtpUser.trim(),
        pass: smtpPass,
      }
    } else if (provider === "RESEND") {
      base.resend = { apiKey: apiKey.trim() }
    } else if (provider === "SENDGRID") {
      base.sendgrid = { apiKey: apiKey.trim() }
    } else if (provider === "MAILCHIMP") {
      base.mailchimp = { apiKey: apiKey.trim() }
    }
    return base
  }

  const credentialsFilled =
    provider === "NONE" ||
    (provider === "SMTP"
      ? smtpHost.trim() && smtpUser.trim() && smtpPass
      : apiKey.trim())

  const onSave = async () => {
    if (!credentialsFilled) return
    setStatusMessage(null)
    try {
      await upsert.mutateAsync(buildInput())
      setApiKey("")
      setSmtpPass("")
      setStatusMessage({ text: t("emailConfig.saved"), ok: true })
    } catch {
      setStatusMessage({ text: t("emailConfig.saveError"), ok: false })
    }
  }

  const onTest = async () => {
    if (!testEmail.trim()) return
    setStatusMessage(null)
    try {
      const result = await testMutation.mutateAsync(testEmail.trim())
      setStatusMessage({
        text: result.ok ? t("emailConfig.testOk") : `${t("emailConfig.testFailed")}: ${result.error?.ar ?? ""}`,
        ok: result.ok,
      })
    } catch {
      setStatusMessage({ text: t("emailConfig.testFailed"), ok: false })
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-muted-foreground text-sm">{t("common.loading")}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("emailConfig.title")}</CardTitle>
          <p className="text-sm text-muted-foreground">{t("emailConfig.hint")}</p>
        </CardHeader>
        <CardContent className="space-y-5">

          {/* Current status badge */}
          {config?.credentialsConfigured && (
            <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2">
              <span className="text-xs font-medium text-success">
                {t("emailConfig.configured")} — {config.provider}
              </span>
              {config.lastTestAt && (
                <span className="text-xs text-muted-foreground ms-auto">
                  {t("emailConfig.lastTest")}:{" "}
                  {config.lastTestOk
                    ? <span className="text-success">✓</span>
                    : <span className="text-destructive">✗</span>
                  }
                </span>
              )}
            </div>
          )}

          {/* Provider selector */}
          <div className="space-y-2">
            <Label>{t("emailConfig.provider")}</Label>
            <Select
              value={provider}
              onValueChange={(v) => {
                setProvider(v as EmailProviderName)
                setApiKey("")
                setStatusMessage(null)
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROVIDERS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Sender identity — shown for all non-NONE providers */}
          {provider !== "NONE" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="email-sender-name">{t("emailConfig.senderName")}</Label>
                <Input
                  id="email-sender-name"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  placeholder={t("emailConfig.senderNamePlaceholder")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email-sender-email">{t("emailConfig.senderEmail")}</Label>
                <Input
                  id="email-sender-email"
                  type="email"
                  value={senderEmail}
                  onChange={(e) => setSenderEmail(e.target.value)}
                  placeholder="noreply@clinic.com"
                  dir="ltr"
                />
              </div>
            </div>
          )}

          {/* Provider-specific credentials */}
          {(provider === "RESEND" || provider === "SENDGRID" || provider === "MAILCHIMP") && (
            <div className="space-y-2">
              <Label htmlFor="email-api-key">{t("emailConfig.apiKey")}</Label>
              <Input
                id="email-api-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={
                  provider === "RESEND"
                    ? "re_..."
                    : provider === "SENDGRID"
                    ? "SG..."
                    : t("emailConfig.apiKeyPlaceholder")
                }
                dir="ltr"
              />
            </div>
          )}

          {provider === "SMTP" && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="smtp-host">{t("emailConfig.smtpHost")}</Label>
                  <Input
                    id="smtp-host"
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    placeholder="smtp.gmail.com"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtp-port">{t("emailConfig.smtpPort")}</Label>
                  <Input
                    id="smtp-port"
                    type="number"
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(e.target.value)}
                    dir="ltr"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtp-user">{t("emailConfig.smtpUser")}</Label>
                <Input
                  id="smtp-user"
                  value={smtpUser}
                  onChange={(e) => setSmtpUser(e.target.value)}
                  placeholder="clinic@example.com"
                  dir="ltr"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtp-pass">{t("emailConfig.smtpPass")}</Label>
                <Input
                  id="smtp-pass"
                  type="password"
                  value={smtpPass}
                  onChange={(e) => setSmtpPass(e.target.value)}
                  dir="ltr"
                />
              </div>
            </div>
          )}

          {/* Save button */}
          <div className="flex items-center gap-3 pt-1">
            <Button
              onClick={onSave}
              disabled={upsert.isPending || !credentialsFilled}
            >
              {upsert.isPending ? t("common.saving") : t("settings.save")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Test section — only shown when credentials are configured */}
      {config?.credentialsConfigured && (
        <Card>
          <CardHeader>
            <CardTitle>{t("emailConfig.testTitle")}</CardTitle>
            <p className="text-sm text-muted-foreground">{t("emailConfig.testHint")}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="test-email-addr">{t("emailConfig.testEmailLabel")}</Label>
              <Input
                id="test-email-addr"
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="owner@clinic.com"
                dir="ltr"
              />
            </div>
            <Button
              variant="outline"
              onClick={onTest}
              disabled={testMutation.isPending || !testEmail.trim()}
            >
              {testMutation.isPending ? t("common.sending") : t("emailConfig.testSend")}
            </Button>

            {statusMessage && (
              <p className={`text-sm ${statusMessage.ok ? "text-success" : "text-destructive"}`}>
                {statusMessage.text}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Non-test status messages */}
      {statusMessage && !config?.credentialsConfigured && (
        <p className={`text-sm ${statusMessage.ok ? "text-success" : "text-destructive"}`}>
          {statusMessage.text}
        </p>
      )}
    </div>
  )
}
