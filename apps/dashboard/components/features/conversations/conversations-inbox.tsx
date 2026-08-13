"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Card, CardContent } from "@sawaa/ui"
import { useLocale } from "@/components/locale-provider"
import { useAuth } from "@/components/providers/auth-provider"
import {
  useAssignableConversationStaff,
  useConversation,
  useConversationMessages,
  useConversations,
} from "@/hooks/use-conversations"
import { useConversationMutations } from "@/hooks/use-conversation-mutations"
import { isConversationClaimConflict } from "@/lib/api/conversations"
import type { ConversationFilters } from "@/lib/types/conversations"
import { ConversationDetail } from "./conversation-detail"
import { ConversationList } from "./conversation-list"

type ActionName = "claim" | "reply" | "assign" | "release" | "close"

export function ConversationsInbox() {
  const { t } = useLocale()
  const { user, canDo } = useAuth()
  const [filters, setFilters] = useState<ConversationFilters>({ assigned: "all", limit: 50 })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const markedReadRef = useRef<string | null>(null)
  const list = useConversations(filters)
  const mutations = useConversationMutations()
  const canManage = canDo("conversation", "manage")
  const staff = useAssignableConversationStaff(canManage)

  const listItems = list.data?.data ?? []
  const effectiveSelectedId = selectedId && listItems.some((item) => item.id === selectedId)
    ? selectedId
    : listItems[0]?.id ?? null
  const selectedDetail = useConversation(effectiveSelectedId)
  const selectedMessages = useConversationMessages(effectiveSelectedId)
  const selected = selectedDetail.data ?? listItems.find((item) => item.id === effectiveSelectedId) ?? null
  const latestOwnedMessage = useMemo(
    () => selectedMessages.data?.data.find((message) => message.senderType === "CLIENT" || message.senderType === "VISITOR"),
    [selectedMessages.data?.data],
  )

  useEffect(() => {
    if (!selected || selected.status !== "STAFF_ACTIVE" || selected.assignedStaffUserId !== user?.id || selected.staffUnreadCount < 1) return
    const marker = `${selected.id}:${latestOwnedMessage?.id ?? "all"}`
    if (markedReadRef.current === marker || mutations.markRead.isPending) return
    markedReadRef.current = marker
    mutations.markRead.mutate({ conversationId: selected.id, throughMessageId: latestOwnedMessage?.id })
  }, [latestOwnedMessage?.id, mutations.markRead, selected, user?.id])

  const pendingAction: ActionName | null = mutations.claim.isPending ? "claim"
    : mutations.reply.isPending ? "reply"
      : mutations.assign.isPending ? "assign"
        : mutations.release.isPending ? "release"
          : mutations.close.isPending ? "close" : null

  const run = async (action: ActionName, operation: () => Promise<unknown>) => {
    setActionError(null)
    try {
      await operation()
    } catch (error) {
      setActionError(action === "claim" && isConversationClaimConflict(error)
        ? t("conversations.error.claimConflict")
        : t(`conversations.error.${action}`))
    }
  }

  const requireSelected = () => selected?.id ?? null

  return (
    <Card className="overflow-hidden border-border/80 shadow-sm">
      <CardContent className="p-0">
        <div className="grid min-h-[640px] grid-cols-1 lg:grid-cols-3">
          <ConversationList
            conversations={listItems}
            selectedId={effectiveSelectedId}
            filters={filters}
            isLoading={list.isLoading}
            error={list.error}
            t={t}
            onFiltersChange={setFilters}
            onSelect={(id) => { setSelectedId(id); setActionError(null) }}
            onRetry={() => list.refetch()}
          />
          <ConversationDetail
            conversation={selected}
            messages={selectedMessages.data?.data ?? []}
            isMessagesLoading={selectedMessages.isLoading}
            messagesError={selectedMessages.error}
            currentUserId={user?.id}
            canManage={canManage}
            staffUsers={staff.data ?? []}
            pendingAction={pendingAction}
            actionError={actionError}
            t={t}
            onClaim={() => {
              const id = requireSelected()
              if (id) void run("claim", () => mutations.claim.mutateAsync({ conversationId: id }))
            }}
            onReply={(body) => {
              const id = requireSelected()
              if (id) void run("reply", () => mutations.reply.mutateAsync({ conversationId: id, body }))
            }}
            onAssign={(targetStaffUserId) => {
              const id = requireSelected()
              if (id) void run("assign", () => mutations.assign.mutateAsync({ conversationId: id, targetStaffUserId }))
            }}
            onRelease={() => {
              const id = requireSelected()
              if (id) void run("release", () => mutations.release.mutateAsync({ conversationId: id }))
            }}
            onClose={() => {
              const id = requireSelected()
              if (id) void run("close", () => mutations.close.mutateAsync({ conversationId: id }))
            }}
          />
        </div>
      </CardContent>
    </Card>
  )
}
