/**
 * Chatbot Knowledge Base API — Sawaa Dashboard
 * Controller: dashboard/ai/knowledge-base
 */

import { api } from "@/lib/api"
import type {
  KnowledgeBaseEntry,
  KnowledgeBaseQuery,
  KnowledgeBaseResponse,
  UpdateKbEntryPayload,
} from "@/lib/types/chatbot"

/* ═══════════════════════════════════════════════════════════
 *  KNOWLEDGE BASE
 * ═══════════════════════════════════════════════════════════ */

export async function fetchKnowledgeBase(
  query: KnowledgeBaseQuery = {},
): Promise<KnowledgeBaseResponse> {
  return api.get<KnowledgeBaseResponse>("/dashboard/ai/knowledge-base", {
    page: query.page,
    limit: query.perPage,
    status: query.status,
  })
}

export async function updateKnowledgeEntry(
  id: string,
  payload: UpdateKbEntryPayload,
): Promise<KnowledgeBaseEntry> {
  return api.patch<KnowledgeBaseEntry>(
    `/dashboard/ai/knowledge-base/${id}`,
    payload,
  )
}

export async function deleteKnowledgeEntry(id: string): Promise<void> {
  return api.delete<void>(`/dashboard/ai/knowledge-base/${id}`)
}
