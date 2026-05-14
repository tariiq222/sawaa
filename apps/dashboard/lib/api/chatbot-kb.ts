/**
 * Chatbot Knowledge Base API — Deqah Dashboard
 */

import { api, getAccessToken } from "@/lib/api"
import type { PaginatedResponse } from "@/lib/api"
import type {
  KnowledgeBaseEntry,
  KnowledgeBaseQuery,
  KnowledgeBaseFile,
  CreateKbEntryPayload,
  UpdateKbEntryPayload,
} from "@/lib/types/chatbot"

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5100/api/v1"

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
 * Uses native fetch with FormData (not the JSON api client).
 */
export async function uploadKnowledgeFile(
  file: File,
): Promise<KnowledgeBaseFile> {
  const formData = new FormData()
  formData.append("file", file)

  const token = getAccessToken()
  const res = await fetch(`${API_BASE_URL}/dashboard/ai/knowledge-base/files`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    console.error("[chatbot-kb] uploadKnowledgeFile failed", {
      status: res.status,
      body,
    })
    throw new Error(body?.message ?? body?.error?.message ?? res.statusText)
  }

  return res.json()
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
