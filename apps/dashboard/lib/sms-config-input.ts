import type { SmsProvider, UpsertSmsConfigInput } from "@/lib/types/sms"

/** Blank fields preserve stored secrets; any replacement must be complete. */
export function buildSmsConfigInput(provider: SmsProvider, senderId: string, appSid: string, apiKey: string, apiToken: string): UpsertSmsConfigInput {
  const input: UpsertSmsConfigInput = { provider, senderId: senderId.trim() }
  if (provider === "UNIFONIC" && (appSid.trim() || apiKey.trim())) {
    if (!appSid.trim() || !apiKey.trim()) throw new Error("SMS_CREDENTIALS_REQUIRED")
    input.unifonic = { appSid: appSid.trim(), apiKey: apiKey.trim() }
  }
  if (provider === "TAQNYAT" && apiToken.trim()) input.taqnyat = { apiToken: apiToken.trim() }
  return input
}
