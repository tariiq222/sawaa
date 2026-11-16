/**
 * Email provider config API — Sawaa Dashboard
 *
 * Every call goes through the typed helper in `lib/api/openapi.ts`, so a
 * renamed route or a changed payload is a type error here. Response types come
 * from the committed OpenAPI snapshot through `lib/types/email-config.ts`.
 * Request URLs, bodies and the returned wire object are unchanged.
 */

import { openApi } from "@/lib/api/openapi"
import type {
  EmailConfigView,
  TestEmailResult,
  UpsertEmailConfigInput,
} from "@/lib/types/email-config"

const EMAIL_CONFIG_PATH = "/api/v1/dashboard/comms/settings/email"

export async function fetchEmailConfig(): Promise<EmailConfigView> {
  return openApi.get(EMAIL_CONFIG_PATH)
}

export async function upsertEmailConfig(
  input: UpsertEmailConfigInput,
): Promise<EmailConfigView> {
  return openApi.post(EMAIL_CONFIG_PATH, { body: input })
}

export async function sendTestEmail(
  toEmail: string,
): Promise<TestEmailResult> {
  return openApi.post("/api/v1/dashboard/comms/settings/email/test", {
    body: { toEmail },
  })
}
