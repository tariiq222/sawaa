"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  assignConversation,
  claimConversation,
  closeConversation,
  markConversationRead,
  releaseConversation,
  replyToConversation,
} from "@/lib/api/conversations"
import type { MarkConversationReadPayload } from "@/lib/types/conversations"
import { queryKeys } from "@/lib/query-keys"

function createClientMessageId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `staff-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function useConversationMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all })

  const claim = useMutation({
    mutationFn: ({ conversationId }: { conversationId: string }) => claimConversation(conversationId),
    onSuccess: invalidate,
  })
  const reply = useMutation({
    mutationFn: ({ conversationId, body }: { conversationId: string; body: string }) =>
      replyToConversation(conversationId, { body, clientMessageId: createClientMessageId() }),
    onSuccess: invalidate,
  })
  const assign = useMutation({
    mutationFn: ({ conversationId, targetStaffUserId }: { conversationId: string; targetStaffUserId: string }) =>
      assignConversation(conversationId, targetStaffUserId),
    onSuccess: invalidate,
  })
  const release = useMutation({
    mutationFn: ({ conversationId }: { conversationId: string }) => releaseConversation(conversationId),
    onSuccess: invalidate,
  })
  const close = useMutation({
    mutationFn: ({ conversationId }: { conversationId: string }) => closeConversation(conversationId),
    onSuccess: invalidate,
  })
  const markRead = useMutation({
    mutationFn: ({ conversationId, ...payload }: { conversationId: string } & MarkConversationReadPayload) =>
      markConversationRead(conversationId, payload),
    onSuccess: invalidate,
  })

  return { claim, reply, assign, release, close, markRead }
}
