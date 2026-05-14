// email-provider — organization email provider config types (dashboard).

export type EmailProviderName = "NONE" | "SMTP" | "RESEND" | "SENDGRID" | "MAILCHIMP"

export interface EmailConfigView {
  id: string
  organizationId: string
  provider: EmailProviderName
  senderName: string | null
  senderEmail: string | null
  credentialsConfigured: boolean
  lastTestAt: string | null
  lastTestOk: boolean | null
  createdAt: string
  updatedAt: string
}

export interface SmtpCredentialsInput {
  host: string
  port: number
  user: string
  pass: string
  secure?: boolean
}

export interface UpsertEmailConfigInput {
  provider: EmailProviderName
  senderName?: string
  senderEmail?: string
  smtp?: SmtpCredentialsInput
  resend?: { apiKey: string }
  sendgrid?: { apiKey: string }
  mailchimp?: { apiKey: string }
}

export interface TestEmailResult {
  ok: boolean
  messageId?: string
  error?: { ar: string; en: string }
}
