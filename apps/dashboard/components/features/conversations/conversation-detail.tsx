"use client"

import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Skeleton } from "@sawaa/ui"
import type { Conversation, ConversationMessage } from "@/lib/types/conversations"
import { ConversationComposer } from "./conversation-composer"

interface StaffUser { id: string; name: string }
interface ConversationDetailProps {
  conversation: Conversation | null
  messages: ConversationMessage[]
  isMessagesLoading: boolean
  messagesError: Error | null
  currentUserId?: string | null
  canManage: boolean
  staffUsers: StaffUser[]
  pendingAction: "claim" | "reply" | "assign" | "release" | "close" | null
  actionError: string | null
  t: (key: string) => string
  onClaim: () => void
  onReply: (body: string) => void
  onAssign: (staffUserId: string) => void
  onRelease: () => void
  onClose: () => void
}

export function ConversationDetail(props: ConversationDetailProps) {
  const { conversation, t } = props
  if (!conversation) return <DetailPlaceholder t={t} />

  const isOwner = !props.currentUserId || conversation.assignedStaffUserId === props.currentUserId
  const canAct = props.canManage || isOwner
  const canReply = conversation.status === "STAFF_ACTIVE" && isOwner
  const canRelease = conversation.status === "STAFF_ACTIVE" && canAct
  const canClose = conversation.status !== "CLOSED" && conversation.status !== "AI_ACTIVE" && canAct

  return (
    <section className="flex min-w-0 flex-col p-4 lg:col-span-2 lg:p-5" aria-label={t("conversations.detail.label")}>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border/70 pb-4">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold text-foreground">{conversation.guestName?.trim() || conversation.guestPhone || t("conversations.guest")}</h2>
          {conversation.guestPhone && <p dir="ltr" className="mt-1 text-start text-sm text-muted-foreground">{conversation.guestPhone}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {conversation.status === "WAITING_FOR_STAFF" && (
            <Button size="sm" disabled={Boolean(props.pendingAction)} onClick={props.onClaim}>{t("conversations.detail.claim")}</Button>
          )}
          {canRelease && <Button variant="outline" size="sm" disabled={Boolean(props.pendingAction)} onClick={props.onRelease}>{t("conversations.detail.release")}</Button>}
          {canClose && <Button variant="outline" size="sm" disabled={Boolean(props.pendingAction)} onClick={props.onClose}>{t("conversations.detail.close")}</Button>}
        </div>
      </header>

      {props.canManage && ["WAITING_FOR_STAFF", "STAFF_ACTIVE"].includes(conversation.status) && (
        <div className="mt-4 max-w-sm">
          <label htmlFor="conversation-assignee" className="mb-1.5 block text-xs font-medium text-muted-foreground">{t("conversations.detail.assignee")}</label>
          <Select value={conversation.assignedStaffUserId ?? undefined} onValueChange={props.onAssign} disabled={props.pendingAction === "assign"}>
            <SelectTrigger id="conversation-assignee" aria-label={t("conversations.detail.assignee")} className="bg-surface-solid">
              <SelectValue placeholder={t("conversations.detail.unassigned")} />
            </SelectTrigger>
            <SelectContent>{props.staffUsers.map((user) => <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )}

      {conversation.status === "AI_ACTIVE" && <StateNote>{t("conversations.detail.aiActive")}</StateNote>}
      {conversation.status === "CLOSED" && <StateNote>{t("conversations.detail.closed")}</StateNote>}
      {props.actionError && <p role="alert" className="mt-4 rounded-lg border border-error/30 bg-error-soft/40 p-3 text-sm text-error">{props.actionError}</p>}

      <div className="my-4 min-h-80 flex-1 space-y-3 overflow-y-auto rounded-xl border border-border/70 bg-surface-muted/20 p-4">
        {props.isMessagesLoading && Array.from({ length: 4 }, (_, index) => <Skeleton key={index} aria-label={index === 0 ? t("conversations.detail.messagesLoading") : undefined} className={`h-14 w-3/4 rounded-xl ${index % 2 ? "ms-auto" : ""}`} />)}
        {!props.isMessagesLoading && props.messagesError && <p role="alert" className="text-sm text-error">{t("conversations.detail.messagesError")}</p>}
        {!props.isMessagesLoading && !props.messagesError && props.messages.length === 0 && <p className="py-12 text-center text-sm text-muted-foreground">{t("conversations.detail.noMessages")}</p>}
        {!props.isMessagesLoading && !props.messagesError && [...props.messages].reverse().map((message) => <MessageBubble key={message.id} message={message} t={t} />)}
      </div>

      {canReply && <ConversationComposer isPending={props.pendingAction === "reply"} t={t} onSend={props.onReply} />}
    </section>
  )
}

function MessageBubble({ message, t }: { message: ConversationMessage; t: (key: string) => string }) {
  const outgoing = message.senderType === "STAFF" || message.senderType === "AI"
  return (
    <article className={`max-w-[85%] rounded-xl px-3 py-2 ${outgoing ? "ms-auto bg-primary text-primary-foreground" : "me-auto border border-border bg-surface-solid text-foreground"}`}>
      <p className="text-[11px] font-medium opacity-75">{t(`conversations.sender.${message.senderType}`)}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{message.body}</p>
    </article>
  )
}

function StateNote({ children }: { children: React.ReactNode }) {
  return <p className="mt-4 rounded-lg border border-border bg-surface-muted/40 p-3 text-sm text-muted-foreground">{children}</p>
}

function DetailPlaceholder({ t }: { t: (key: string) => string }) {
  return <section className="flex min-h-[560px] flex-col items-center justify-center p-8 text-center lg:col-span-2"><p className="font-medium text-foreground">{t("conversations.detail.select")}</p><p className="mt-1 text-sm text-muted-foreground">{t("conversations.detail.selectDescription")}</p></section>
}
