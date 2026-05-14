/**
 * Email Templates API — Deqah Dashboard
 */

import { api } from "@/lib/api"
import type {
  EmailTemplate,
  UpdateEmailTemplatePayload,
  TemplatePreviewPayload,
  TemplatePreviewResult,
} from "@/lib/types/email-template"

/* ─── List ─── */

export async function fetchEmailTemplates(): Promise<EmailTemplate[]> {
  const res = await api.get<{ items: EmailTemplate[] } | EmailTemplate[]>("/dashboard/comms/email-templates")
  return Array.isArray(res) ? res : res.items
}

/* ─── Detail ─── */

export async function fetchEmailTemplate(id: string): Promise<EmailTemplate> {
  return api.get<EmailTemplate>(`/dashboard/comms/email-templates/${id}`)
}

/* ─── Update ─── */

export async function updateEmailTemplate(
  id: string,
  payload: UpdateEmailTemplatePayload,
): Promise<EmailTemplate> {
  return api.patch<EmailTemplate>(
    `/dashboard/comms/email-templates/${id}`,
    payload,
  )
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
