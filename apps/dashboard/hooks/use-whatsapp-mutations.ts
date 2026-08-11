"use client"

// whatsapp — dashboard mutations for WhatsApp AI agent.
// All mutations invalidate the corresponding queries after success.

import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  closeWhatsappConversation,
  controlWhatsapp,
  resetWhatsappConfig,
  staffReply,
  markWhatsappConversationRead,
  releaseWhatsappTakeover,
  testWhatsappConfig,
  unlinkWhatsappConfig,
  upsertWhatsappAgentConfig,
  upsertWhatsappConfig,
} from "@/lib/api/whatsapp"
import type {
  StaffReplyInput,
  StaffReplyResult,
  UpsertWhatsappAgentConfigInput,
  UpsertWhatsappConfigInput,
  UpsertWhatsappConfigResult,
  WhatsappAgentConfigView,
  WhatsappControlInput,
  WhatsappControlResult,
} from "@/lib/types/whatsapp"

// ── Config ──────────────────────────────────────────────────────────────

export function useUpsertWhatsappConfig() {
  const qc = useQueryClient()
  return useMutation<
    UpsertWhatsappConfigResult,
    Error,
    UpsertWhatsappConfigInput
  >({
    mutationFn: upsertWhatsappConfig,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["whatsapp", "config"] })
      qc.invalidateQueries({ queryKey: ["whatsapp", "status"] })
    },
  })
}

export function useTestWhatsappConfig() {
  const qc = useQueryClient()
  return useMutation<{ ok: boolean; state?: string; phone?: string; error?: string }, Error, void>({
    mutationFn: testWhatsappConfig,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["whatsapp", "config"] })
    },
  })
}

export function useResetWhatsappConfig() {
  const qc = useQueryClient()
  return useMutation<{ reset: boolean }, Error, void>({
    mutationFn: resetWhatsappConfig,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["whatsapp"] })
    },
  })
}

export function useUnlinkWhatsappConfig() {
  const qc = useQueryClient()
  return useMutation<{ unlinked: boolean; logoutOk: boolean }, Error, void>({
    mutationFn: unlinkWhatsappConfig,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["whatsapp", "config"] })
      qc.invalidateQueries({ queryKey: ["whatsapp", "status"] })
      qc.invalidateQueries({ queryKey: ["whatsapp", "agent-config"] })
      qc.invalidateQueries({ queryKey: ["whatsapp", "conversations"] })
    },
  })
}

// ── AI agent config ────────────────────────────────────────────────────

export function useUpsertWhatsappAgentConfig() {
  const qc = useQueryClient()
  return useMutation<
    WhatsappAgentConfigView,
    Error,
    UpsertWhatsappAgentConfigInput
  >({
    mutationFn: upsertWhatsappAgentConfig,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["whatsapp", "agent-config"] })
    },
  })
}

// ── Runtime control ───────────────────────────────────────────────────

export function useWhatsappControl() {
  const qc = useQueryClient()
  return useMutation<
    WhatsappControlResult,
    Error,
    WhatsappControlInput
  >({
    mutationFn: controlWhatsapp,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["whatsapp", "status"] })
      qc.invalidateQueries({ queryKey: ["whatsapp", "config"] })
    },
  })
}

// ── Conversations ───────────────────────────────────────────────────

export function useStaffReply(conversationId: string | null) {
  const qc = useQueryClient()
  return useMutation<StaffReplyResult, Error, StaffReplyInput>({
    mutationFn: (input) => staffReply(conversationId as string, input),
    onSuccess: () => {
      if (!conversationId) return
      qc.invalidateQueries({ queryKey: ["whatsapp", "conversation", conversationId] })
      qc.invalidateQueries({ queryKey: ["whatsapp", "conversations"] })
    },
  })
}

export function useCloseWhatsappConversation() {
  const qc = useQueryClient()
  return useMutation<{ closed: true }, Error, string>({
    mutationFn: closeWhatsappConversation,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["whatsapp", "conversations"] })
    },
  })
}

export function useMarkWhatsappConversationRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, throughMessageId }: { id: string; throughMessageId?: string }) =>
      markWhatsappConversationRead(id, throughMessageId),
    onSuccess: (_result, variables) => {
      qc.invalidateQueries({ queryKey: ["whatsapp", "conversation", variables.id] })
      qc.invalidateQueries({ queryKey: ["whatsapp", "conversations"] })
    },
  })
}

export function useReleaseWhatsappTakeover() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: releaseWhatsappTakeover,
    onSuccess: (_result, id) => {
      qc.invalidateQueries({ queryKey: ["whatsapp", "conversation", id] })
      qc.invalidateQueries({ queryKey: ["whatsapp", "conversations"] })
    },
  })
}
