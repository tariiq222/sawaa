"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import {
  updateKnowledgeEntry,
  deleteKnowledgeEntry,
} from "@/lib/api/chatbot-kb"
import { endChatSession, sendStaffMessage, upsertChatbotConfig } from "@/lib/api/chatbot"
import type { UpdateKbEntryPayload, UpsertChatbotConfigPayload } from "@/lib/types/chatbot"

function stub<T = Record<string, unknown>>(defaultVal: T = {} as T) {
  return {
    mutate: (_arg?: unknown) => {},
    mutateAsync: async (_arg?: unknown): Promise<T> => defaultVal,
    isPending: false,
  }
}

export function useChatbotMutations() {
  const qc = useQueryClient()

  const invalidateKb = () => qc.invalidateQueries({ queryKey: queryKeys.chatbot.knowledgeBase.all })

  const updateKbEntryMut = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateKbEntryPayload }) =>
      updateKnowledgeEntry(id, payload),
    onSuccess: invalidateKb,
  })

  const deleteKbEntryMut = useMutation({
    mutationFn: (id: string) => deleteKnowledgeEntry(id),
    onSuccess: invalidateKb,
  })

  const endSessionMut = useMutation({
    mutationFn: (sessionId: string) => endChatSession(sessionId),
    onSuccess: (_data, sessionId) => {
      void qc.invalidateQueries({ queryKey: queryKeys.chatbot.sessions.all })
      void qc.invalidateQueries({ queryKey: queryKeys.chatbot.sessions.detail(sessionId) })
    },
  })

  const staffMsgMut = useMutation({
    mutationFn: ({ sessionId, content }: { sessionId: string; content: string }) =>
      sendStaffMessage(sessionId, content),
    onSuccess: (_data, { sessionId }) => {
      void qc.invalidateQueries({ queryKey: queryKeys.chatbot.sessions.all })
      void qc.invalidateQueries({ queryKey: queryKeys.chatbot.sessions.detail(sessionId) })
    },
  })

  const updateConfigMut = useMutation({
    mutationFn: (payload: UpsertChatbotConfigPayload) =>
      upsertChatbotConfig(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.chatbot.config.all })
    },
  })

  return {
    // Session mutations — no backend endpoints yet
    createSessionMut: stub(),
    endSessionMut,
    sendMessageMut: stub(),
    staffMsgMut,

    // KB mutations
    updateKbEntryMut,
    deleteKbEntryMut,

    // Config mutations — seedDefaultsMut deferred (no backend endpoint)
    updateConfigMut,
    seedDefaultsMut: stub(),
  }
}
