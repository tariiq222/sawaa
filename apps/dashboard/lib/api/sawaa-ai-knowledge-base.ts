import { api } from "@/lib/api"

export type KnowledgeStatus = "PENDING" | "EMBEDDED" | "FAILED"
export type KnowledgeSourceType = "manual" | "url"
export type KnowledgeEntry = {
  id: string
  title: string
  content?: string | null
  sourceType: KnowledgeSourceType
  sourceRef: string | null
  status: KnowledgeStatus
  isPublished: boolean
  publishedAt: string | null
  lastIndexedAt: string | null
  lastIndexErrorCode: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
  chunks?: Array<{ id: string; chunkIndex: number; tokenCount: number }>
}
export type KnowledgePage = { data: KnowledgeEntry[]; meta: { total: number; page: number; limit: number; totalPages: number } }
export type KnowledgeInput = { title: string; content?: string; sourceType: KnowledgeSourceType; sourceRef?: string }

export function fetchSawaaAiKnowledge(page = 1, limit = 20) {
  return api.get<KnowledgePage>("/dashboard/ai/knowledge-base", { page, limit })
}
export function fetchSawaaAiKnowledgeEntry(id: string) {
  return api.get<KnowledgeEntry>(`/dashboard/ai/knowledge-base/${id}`)
}
export function createSawaaAiKnowledge(input: KnowledgeInput) {
  return api.post<KnowledgeEntry>("/dashboard/ai/knowledge-base", input)
}
export function updateSawaaAiKnowledge(id: string, input: Partial<KnowledgeInput>) {
  return api.patch<KnowledgeEntry>(`/dashboard/ai/knowledge-base/${id}`, input)
}
export function publishSawaaAiKnowledge(id: string) { return api.post<KnowledgeEntry>(`/dashboard/ai/knowledge-base/${id}/publish`) }
export function unpublishSawaaAiKnowledge(id: string) { return api.post<KnowledgeEntry>(`/dashboard/ai/knowledge-base/${id}/unpublish`) }
export function reindexSawaaAiKnowledge(id: string) { return api.post<KnowledgeEntry>(`/dashboard/ai/knowledge-base/${id}/reindex`) }
export function deleteSawaaAiKnowledge(id: string) { return api.delete<void>(`/dashboard/ai/knowledge-base/${id}`) }
