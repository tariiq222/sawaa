// email-provider — email config API client (dashboard).

import { api } from "@/lib/api"
import type {
  EmailConfigView,
  TestEmailResult,
  UpsertEmailConfigInput,
} from "@/lib/types/email-config"

export async function fetchEmailConfig(): Promise<EmailConfigView> {
  return api.get<EmailConfigView>("/dashboard/comms/settings/email")
}

export async function upsertEmailConfig(
  input: UpsertEmailConfigInput,
): Promise<EmailConfigView> {
  return api.post<EmailConfigView>("/dashboard/comms/settings/email", input)
}

export async function sendTestEmail(
  toEmail: string,
): Promise<TestEmailResult> {
  return api.post<TestEmailResult>(
    "/dashboard/comms/settings/email/test",
    { toEmail },
  )
}
