/**
 * Tenant Moyasar config API — Sawaa Dashboard.
 *
 * Secret keys are submitted only to the backend and never returned. Response
 * and payload types are derived from the committed OpenAPI snapshot; every call
 * goes through the typed helper in `lib/api/openapi.ts` with the same URL and
 * body, so the request is byte-identical.
 *
 * Security: `MoyasarConfig` carries the masked key + the `hasWebhookSecret`
 * boolean only; the update response is the four-field handler projection. The
 * snapshot contains no ciphertext or plaintext secret for these routes.
 */

import { api } from "@/lib/api"
import { openApi } from "@/lib/api/openapi"
import type { components } from "@/lib/types/api.generated"

type Schemas = components["schemas"]

export type MoyasarConfig = Schemas["MoyasarConfigViewDto"]

/**
 * Body of `PATCH /dashboard/finance/moyasar/config`.
 *
 * Documented as `UpsertMoyasarConfigDto`. `isLive` carries `default: false`, so
 * the generator marks it required; the handler treats it as optional and keeps
 * the stored mode when omitted, which is exactly what the dashboard does when
 * rotating only the publishable key. The field is therefore optional here, with
 * the same type.
 */
type UpsertMoyasarConfigWire = Schemas["UpsertMoyasarConfigDto"]
export type UpsertMoyasarConfigPayload = Omit<UpsertMoyasarConfigWire, "isLive"> & {
  isLive?: UpsertMoyasarConfigWire["isLive"]
}

export type TestMoyasarConfigResult = Schemas["MoyasarConfigTestResponseDto"]

export async function fetchMoyasarConfig(): Promise<MoyasarConfig | null> {
  return openApi.get("/api/v1/dashboard/finance/moyasar/config")
}

export async function upsertMoyasarConfig(
  payload: UpsertMoyasarConfigPayload,
): Promise<Pick<MoyasarConfig, "publishableKey" | "isLive" | "updatedAt">> {
  // The handler returns exactly { organizationId, publishableKey, isLive,
  // updatedAt }; the dashboard only reads the three below (unchanged).
  return openApi.patch("/api/v1/dashboard/finance/moyasar/config", {
    body: payload as UpsertMoyasarConfigWire,
  })
}

export async function testMoyasarConfig(): Promise<TestMoyasarConfigResult> {
  // Transport stays on the plain client: the typed helper has no body for this
  // route, while the existing call sends an explicit `{}` (request must stay
  // byte-identical).
  return api.post<TestMoyasarConfigResult>("/dashboard/finance/moyasar/config/test", {})
}
