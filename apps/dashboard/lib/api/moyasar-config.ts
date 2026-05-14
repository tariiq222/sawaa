/**
 * Tenant Moyasar config API — Deqah Dashboard.
 *
 * Secret keys are submitted only to the backend and never returned.
 */

import { api } from "@/lib/api"

export interface MoyasarConfig {
  publishableKey: string
  secretKeyMasked: string
  hasWebhookSecret: boolean
  isLive: boolean
  lastVerifiedAt: string | null
  lastVerifiedStatus: string | null
  updatedAt: string
}

export interface UpsertMoyasarConfigPayload {
  publishableKey: string
  secretKey: string
  webhookSecret: string
  isLive: boolean
}

export interface TestMoyasarConfigResult {
  ok: boolean
  status: string
}

export async function fetchMoyasarConfig(): Promise<MoyasarConfig | null> {
  return api.get<MoyasarConfig | null>("/dashboard/finance/moyasar/config")
}

export async function upsertMoyasarConfig(
  payload: UpsertMoyasarConfigPayload,
): Promise<Pick<MoyasarConfig, "publishableKey" | "isLive" | "updatedAt">> {
  return api.patch<Pick<MoyasarConfig, "publishableKey" | "isLive" | "updatedAt">>(
    "/dashboard/finance/moyasar/config",
    payload,
  )
}

export async function testMoyasarConfig(): Promise<TestMoyasarConfigResult> {
  return api.post<TestMoyasarConfigResult>("/dashboard/finance/moyasar/config/test", {})
}
