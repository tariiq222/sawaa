"use client"

import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Skeleton } from "@sawaa/ui"
import type { Conversation, ConversationMessage } from "@/lib/types/conversations"
import { ConversationComposer } from "./conversation-composer"

interface StaffUser { id: string; name: string }
interface ConversationDetailProps {
  conversation: Conversation | null
  isDetailLoading: boolean
  detailError: Error | null
  messages: ConversationMessage[]
  isMessagesLoading: boolean
  messagesError: Error | null
  hasOlderMessages: boolean
  isLoadingOlderMessages: boolean
  onLoadOlderMessages: () => void
  currentUserId?: string | null
  canManage: boolean
  canUpdate: boolean
  staffUsers: StaffUser[]
  pendingAction: "claim" | "reply" | "assign" | "release" | "close" | null
  actionError: string | null
  t: (key: string) => string
  onClaim: () => void
  onReply: (body: string) => Promise<boolean>
  onAssign: (staffUserId: string) => void
  onRelease: () => void
  onClose: () => void
}

export function ConversationDetail(props: ConversationDetailProps) {
  const { conversation, t } = props
  if (props.isDetailLoading) {
    return <section aria-label={t("conversations.detail.loading")} className="space-y-4 p-5 lg:col-span-2"><Skeleton className="h-16 rounded-xl" /><Skeleton className="h-[480px] rounded-xl" /></section>
  }
  if (props.detailError) {
    return <section className="p-5 lg:col-span-2"><p role="alert" className="rounded-xl border border-error/30 bg-error-soft/40 p-4 text-sm text-error">{t("conversations.detail.error")}</p></section>
  }
  if (!conversation) return <DetailPlaceholder t={t} />

  const isOwner = !props.currentUserId || conversation.assignedStaffUserId === props.currentUserId
  const canAct = props.canManage || isOwner
  const canReply = props.canUpdate && conversation.status === "STAFF_ACTIVE" && isOwner
  const canRelease = props.canUpdate && conversation.status === "STAFF_ACTIVE" && conversation.isAiChat && canAct
  const canClose = props.canUpdate && conversation.status !== "CLOSED" && (props.canManage || (conversation.status !== "AI_ACTIVE" && isOwner))

  return (
    <section className="flex min-w-0 flex-col p-4 lg:col-span-2 lg:p-5" aria-label={t("conversations.detail.label")}>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border/70 pb-4">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold text-foreground">{conversation.guestName?.trim() || conversation.guestPhone || t("conversations.guest")}</h2>
          {conversation.guestPhone && <p dir="ltr" className="mt-1 text-start text-sm text-muted-foreground">{conversation.guestPhone}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {props.canUpdate && conversation.status === "WAITING_FOR_STAFF" && (
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

      {conversation.handoffSummary && <HandoffSummaryCard summary={conversation.handoffSummary} t={t} />}

      <div className="my-4 min-h-80 flex-1 space-y-3 overflow-y-auto rounded-xl border border-border/70 bg-surface-muted/20 p-4">
        {props.hasOlderMessages && (
          <Button variant="outline" size="sm" className="mx-auto flex" disabled={props.isLoadingOlderMessages} onClick={props.onLoadOlderMessages}>
            {t("conversations.detail.loadOlder")}
          </Button>
        )}
        {props.isMessagesLoading && Array.from({ length: 4 }, (_, index) => <Skeleton key={index} aria-label={index === 0 ? t("conversations.detail.messagesLoading") : undefined} className={`h-14 w-3/4 rounded-xl ${index % 2 ? "ms-auto" : ""}`} />)}
        {!props.isMessagesLoading && props.messagesError && <p role="alert" className="text-sm text-error">{t("conversations.detail.messagesError")}</p>}
        {!props.isMessagesLoading && !props.messagesError && props.messages.length === 0 && <p className="py-12 text-center text-sm text-muted-foreground">{t("conversations.detail.noMessages")}</p>}
        {!props.isMessagesLoading && !props.messagesError && [...props.messages].reverse().map((message) => <MessageBubble key={message.id} message={message} t={t} />)}
      </div>

      {canReply && <ConversationComposer key={conversation.id} isPending={props.pendingAction === "reply"} t={t} onSend={props.onReply} />}
    </section>
  )
}

function HandoffSummaryCard({ summary, t }: { summary: NonNullable<Conversation["handoffSummary"]>; t: (key: string) => string }) {
  return <section aria-label={t("conversations.detail.handoffSummary")} className="mt-4 rounded-xl border border-warning/30 bg-warning-soft/30 p-4">
    <h3 className="text-sm font-semibold text-foreground">{t("conversations.detail.handoffSummary")}</h3>
    <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
      <div><dt className="text-xs text-muted-foreground">{t("conversations.detail.handoffCategory")}</dt><dd className="mt-0.5 text-foreground">{t(`conversations.detail.handoffCategory.${summary.category}`)}</dd></div>
      <div><dt className="text-xs text-muted-foreground">{t("conversations.detail.requestSummary")}</dt><dd className="mt-0.5 whitespace-pre-wrap text-foreground">{summary.requestSummary}</dd></div>
      <div><dt className="text-xs text-muted-foreground">{t("conversations.detail.desiredOutcome")}</dt><dd className="mt-0.5 whitespace-pre-wrap text-foreground">{summary.desiredOutcome}</dd></div>
      {summary.acceptableAlternatives && <div><dt className="text-xs text-muted-foreground">{t("conversations.detail.acceptableAlternatives")}</dt><dd className="mt-0.5 whitespace-pre-wrap text-foreground">{summary.acceptableAlternatives.join("، ")}</dd></div>}
    </dl>
  </section>
}

function MessageBubble({ message, t }: { message: ConversationMessage; t: (key: string) => string }) {
  const outgoing = ["STAFF", "EMPLOYEE", "AI"].includes(message.senderType)
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
