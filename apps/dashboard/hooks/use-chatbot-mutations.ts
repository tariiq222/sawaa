"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import {
  createKnowledgeEntry,
  updateKnowledgeEntry,
  deleteKnowledgeEntry,
  syncKnowledgeBase,
  uploadKnowledgeFile,
  processKnowledgeFile,
  deleteKnowledgeFile,
} from "@/lib/api/chatbot-kb"
import { endChatSession, sendStaffMessage, upsertChatbotConfig } from "@/lib/api/chatbot"
import type { CreateKbEntryPayload, UpdateKbEntryPayload } from "@/lib/types/chatbot"

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
  const invalidateFiles = () => qc.invalidateQueries({ queryKey: queryKeys.chatbot.files.all })

  const createKbEntryMut = useMutation({
    mutationFn: (payload: CreateKbEntryPayload) => createKnowledgeEntry(payload),
    onSuccess: invalidateKb,
  })

  const updateKbEntryMut = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateKbEntryPayload }) =>
      updateKnowledgeEntry(id, payload),
    onSuccess: invalidateKb,
  })

  const deleteKbEntryMut = useMutation({
    mutationFn: (id: string) => deleteKnowledgeEntry(id),
    onSuccess: invalidateKb,
  })

  const syncKbMut = useMutation({
    mutationFn: () => syncKnowledgeBase(),
    onSuccess: invalidateKb,
  })

  const uploadFileMut = useMutation({
    mutationFn: (file: File) => uploadKnowledgeFile(file),
    onSuccess: invalidateFiles,
  })

  const processFileMut = useMutation({
    mutationFn: (id: string) => processKnowledgeFile(id),
    onSuccess: invalidateFiles,
  })

  const deleteFileMut = useMutation({
    mutationFn: (id: string) => deleteKnowledgeFile(id),
    onSuccess: invalidateFiles,
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
    mutationFn: ({ configs }: { configs: { key: string; value: unknown; category: string }[] }) =>
      upsertChatbotConfig(configs),
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
    createKbEntryMut,
    updateKbEntryMut,
    deleteKbEntryMut,
    syncKbMut,

    // File mutations
    uploadFileMut,
    processFileMut,
    deleteFileMut,

    // Config mutations — seedDefaultsMut deferred (no backend endpoint)
    updateConfigMut,
    seedDefaultsMut: stub(),
  }
}
