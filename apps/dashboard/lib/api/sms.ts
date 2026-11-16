/**
 * SMS config + deliveries API — Sawaa Dashboard
 *
 * Every call goes through the typed helper in `lib/api/openapi.ts`. Response
 * types come from the committed OpenAPI snapshot through `lib/types/sms.ts`.
 * Request URLs, bodies and the returned wire object are unchanged.
 */

import { openApi } from "@/lib/api/openapi"
import type {
  SmsConfigView,
  SmsDeliveryRow,
  TestSmsResult,
  UpsertSmsConfigInput,
} from "@/lib/types/sms"

const SMS_CONFIG_PATH = "/api/v1/dashboard/comms/settings/sms"

export async function fetchSmsConfig(): Promise<SmsConfigView> {
  return openApi.get(SMS_CONFIG_PATH)
}

export async function upsertSmsConfig(
  input: UpsertSmsConfigInput,
): Promise<SmsConfigView> {
  return openApi.post(SMS_CONFIG_PATH, { body: input })
}

export async function sendTestSms(
  toPhone: string,
): Promise<TestSmsResult> {
  return openApi.post("/api/v1/dashboard/comms/settings/sms/test", {
    body: { toPhone },
  })
}

export async function fetchSmsDeliveries(): Promise<{ items: SmsDeliveryRow[] }> {
  return openApi.get("/api/v1/dashboard/comms/settings/sms/deliveries")
}
