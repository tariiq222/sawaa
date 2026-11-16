/**
 * Email Templates API — Sawaa Dashboard
 *
 * Response types come from the committed OpenAPI snapshot through
 * `lib/types/email-template.ts`, so a changed payload is a type error here.
 *
 * The id-bearing routes keep the shared `api` client with the exact same
 * template-literal URLs as before: those paths take a `ParseUUIDPipe` id and
 * the previous code did not percent-encode it, so routing them through the
 * typed path helper would alter the request bytes for non-UUID input. Only the
 * param-less list read goes through `lib/api/openapi.ts` (identical URL).
 *
 * The list route answers `{ items, meta }`; `fetchEmailTemplates` still accepts
 * a bare array as a defensive fallback (unchanged behaviour) and returns the
 * same `items` array it always did.
 */

import { api } from "@/lib/api"
import { openApi } from "@/lib/api/openapi"
import type {
  EmailTemplate,
  EmailTemplateListPage,
  UpdateEmailTemplatePayload,
  TemplatePreviewPayload,
  TemplatePreviewResult,
} from "@/lib/types/email-template"

const EMAIL_TEMPLATES_PATH = "/api/v1/dashboard/comms/email-templates"

/* ─── List ─── */

export async function fetchEmailTemplates(): Promise<EmailTemplate[]> {
  const res = (await openApi.get(EMAIL_TEMPLATES_PATH)) as
    | EmailTemplateListPage
    | EmailTemplate[]
  return Array.isArray(res) ? res : res.items
}

/* ─── Detail ─── */

export async function fetchEmailTemplate(id: string): Promise<EmailTemplate | null> {
  return api.get<EmailTemplate | null>(`/dashboard/comms/email-templates/${id}`)
}

/* ─── Update ─── */

export async function updateEmailTemplate(
  id: string,
  payload: UpdateEmailTemplatePayload,
): Promise<EmailTemplate> {
  return api.patch<EmailTemplate>(`/dashboard/comms/email-templates/${id}`, payload)
}

/* ─── Preview ─── */

export async function previewEmailTemplate(
  id: string,
  payload: TemplatePreviewPayload,
): Promise<TemplatePreviewResult> {
  return api.post<TemplatePreviewResult>(
    `/dashboard/comms/email-templates/${id}/preview`,
    payload,
  )
}
