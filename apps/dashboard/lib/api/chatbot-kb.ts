/**
 * Chatbot Knowledge Base API — Sawaa Dashboard
 */

import { api } from "@/lib/api"
import type { PaginatedResponse } from "@/lib/api"
import type {
  KnowledgeBaseEntry,
  KnowledgeBaseQuery,
  KnowledgeBaseFile,
  CreateKbEntryPayload,
  UpdateKbEntryPayload,
} from "@/lib/types/chatbot"

/* ═══════════════════════════════════════════════════════════
 *  KNOWLEDGE BASE
 * ═══════════════════════════════════════════════════════════ */

export async function fetchKnowledgeBase(
  query: KnowledgeBaseQuery = {},
): Promise<PaginatedResponse<KnowledgeBaseEntry>> {
  return api.get<PaginatedResponse<KnowledgeBaseEntry>>(
    "/dashboard/ai/knowledge-base",
    {
      page: query.page,
      limit: query.perPage,
      source: query.source,
      category: query.category,
    },
  )
}

export async function createKnowledgeEntry(
  payload: CreateKbEntryPayload,
): Promise<KnowledgeBaseEntry> {
  return api.post<KnowledgeBaseEntry>("/dashboard/ai/knowledge-base", payload)
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

export async function deleteKnowledgeEntry(
  id: string,
): Promise<{ deleted: boolean }> {
  return api.delete<{ deleted: boolean }>(`/dashboard/ai/knowledge-base/${id}`)
}

export async function syncKnowledgeBase(): Promise<{ synced: number }> {
  return api.post<{ synced: number }>("/dashboard/ai/knowledge-base/sync")
}

/* ═══════════════════════════════════════════════════════════
 *  KNOWLEDGE BASE FILES
 * ═══════════════════════════════════════════════════════════ */

export async function fetchKnowledgeFiles(
  query: { page?: number; perPage?: number } = {},
): Promise<PaginatedResponse<KnowledgeBaseFile>> {
  return api.get<PaginatedResponse<KnowledgeBaseFile>>(
    "/dashboard/ai/knowledge-base/files",
    { page: query.page, limit: query.perPage },
  )
}

/**
 * Upload a file to the knowledge base.
 */
export async function uploadKnowledgeFile(
  file: File,
): Promise<KnowledgeBaseFile> {
  const formData = new FormData()
  formData.append("file", file)

  return api.postForm<KnowledgeBaseFile>(
    "/dashboard/ai/knowledge-base/files",
    formData,
  )
}

export async function processKnowledgeFile(
  id: string,
): Promise<{ processed: boolean }> {
  return api.post<{ processed: boolean }>(
    `/dashboard/ai/knowledge-base/files/${id}/process`,
  )
}

export async function deleteKnowledgeFile(
  id: string,
): Promise<{ deleted: boolean }> {
  return api.delete<{ deleted: boolean }>(
    `/dashboard/ai/knowledge-base/files/${id}`,
  )
}
