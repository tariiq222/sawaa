// SaaS-02g-sms — SMS config + deliveries API client.

import { api } from "@/lib/api"
import type {
  SmsConfigView,
  SmsDeliveryRow,
  TestSmsResult,
  UpsertSmsConfigInput,
} from "@/lib/types/sms"

export async function fetchSmsConfig(): Promise<SmsConfigView> {
  return api.get<SmsConfigView>("/dashboard/comms/settings/sms")
}

export async function upsertSmsConfig(
  input: UpsertSmsConfigInput,
): Promise<SmsConfigView> {
  return api.post<SmsConfigView>("/dashboard/comms/settings/sms", input)
}

export async function sendTestSms(
  toPhone: string,
): Promise<TestSmsResult> {
  return api.post<TestSmsResult>(
    "/dashboard/comms/settings/sms/test",
    { toPhone },
  )
}

export async function fetchSmsDeliveries(): Promise<{ items: SmsDeliveryRow[] }> {
  return api.get<{ items: SmsDeliveryRow[] }>(
    "/dashboard/comms/settings/sms/deliveries",
  )
}
