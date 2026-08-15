"use client"

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  createSawaaAiKnowledge, deleteSawaaAiKnowledge, fetchSawaaAiKnowledge, publishSawaaAiKnowledge,
  reindexSawaaAiKnowledge, unpublishSawaaAiKnowledge, updateSawaaAiKnowledge, fetchSawaaAiKnowledgeEntry,
} from "@/lib/api/sawaa-ai-knowledge-base"

const key = ["sawaa-ai", "knowledge-base"] as const
export function useSawaaAiKnowledge() {
  return useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }) => fetchSawaaAiKnowledge(pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined,
    staleTime: 30_000,
  })
}
export function useSawaaAiKnowledgeDetail(id: string | null) {
  return useQuery({ queryKey: [...key, "detail", id], queryFn: () => fetchSawaaAiKnowledgeEntry(id!), enabled: Boolean(id), staleTime: 30_000 })
}
export function useSawaaAiKnowledgeMutations() {
  const qc = useQueryClient()
  const refresh = () => qc.invalidateQueries({ queryKey: key })
  return {
    create: useMutation({ mutationFn: createSawaaAiKnowledge, onSuccess: refresh }),
    update: useMutation({ mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateSawaaAiKnowledge>[1] }) => updateSawaaAiKnowledge(id, input), onSuccess: refresh }),
    publish: useMutation({ mutationFn: publishSawaaAiKnowledge, onSuccess: refresh }),
    unpublish: useMutation({ mutationFn: unpublishSawaaAiKnowledge, onSuccess: refresh }),
    reindex: useMutation({ mutationFn: reindexSawaaAiKnowledge, onSuccess: refresh }),
    remove: useMutation({ mutationFn: deleteSawaaAiKnowledge, onSuccess: refresh }),
  }
}
