"use client"

import { Button, Skeleton } from "@sawaa/ui"
import type { Conversation, ConversationFilters, ConversationStatus } from "@/lib/types/conversations"
import { ConversationFilterControls } from "./conversation-filters"

const STATUS_CLASSES: Record<ConversationStatus, string> = {
  OPEN: "bg-surface-muted text-muted-foreground",
  WAITING_FOR_STAFF: "bg-warning/15 text-warning",
  STAFF_ACTIVE: "bg-success/15 text-success",
  AI_ACTIVE: "bg-primary-ultra-light text-primary-dark",
  CLOSED: "bg-surface-muted text-muted-foreground",
}

interface ConversationListProps {
  conversations: Conversation[]
  selectedId: string | null
  filters: ConversationFilters
  isLoading: boolean
  error: Error | null
  locale: "ar" | "en"
  hasNextPage: boolean
  isFetchingNextPage: boolean
  t: (key: string) => string
  onFiltersChange: (filters: ConversationFilters) => void
  onSelect: (conversationId: string) => void
  onRetry: () => void
  onLoadMore: () => void
}

function displayName(conversation: Conversation, t: (key: string) => string) {
  return conversation.guestName?.trim() || conversation.guestPhone || t("conversations.guest")
}

function formatTime(value: string | null, locale: "ar" | "en") {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-SA-u-nu-latn" : "en-US", { hour: "2-digit", minute: "2-digit" }).format(date)
}

export function ConversationList(props: ConversationListProps) {
  const { conversations, selectedId, filters, isLoading, error, t } = props
  return (
    <aside className="min-w-0 border-b border-border/70 bg-surface-muted/20 p-4 lg:border-e lg:border-b-0">
      <ConversationFilterControls filters={filters} t={t} onChange={props.onFiltersChange} />

      <div className="mt-4 space-y-2">
        {isLoading && Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-24 rounded-xl" aria-label={index === 0 ? t("conversations.loading") : undefined} />
        ))}
        {!isLoading && error && (
          <div role="alert" className="rounded-xl border border-error/30 bg-error-soft/40 p-4 text-sm text-error">
            <p>{t("conversations.error")}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={props.onRetry}>{t("conversations.retry")}</Button>
          </div>
        )}
        {!isLoading && !error && conversations.length === 0 && (
          <div className="rounded-xl border border-dashed border-border-strong p-6 text-center">
            <p className="font-medium text-foreground">{t("conversations.empty.title")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("conversations.empty.description")}</p>
          </div>
        )}
        {!isLoading && !error && conversations.map((conversation) => {
          const name = displayName(conversation, t)
          return (
            <button
              type="button"
              key={conversation.id}
              aria-pressed={selectedId === conversation.id}
              aria-label={`${name} ${t(`conversations.status.${conversation.status}`)}`}
              onClick={() => props.onSelect(conversation.id)}
              className={`w-full rounded-xl border p-3 text-start transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none ${selectedId === conversation.id ? "border-primary bg-surface-solid shadow-sm" : "border-border/70 bg-surface-solid/70 hover:border-primary/40"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{name}</p>
                  {conversation.guestPhone && <p dir="ltr" className="mt-1 text-start text-xs text-muted-foreground">{conversation.guestPhone}</p>}
                </div>
                <time dateTime={conversation.lastMessageAt ?? undefined} className="shrink-0 text-xs text-muted-foreground tabular-nums">{formatTime(conversation.lastMessageAt, props.locale)}</time>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <span className={`rounded-full px-2 py-1 text-xs ${STATUS_CLASSES[conversation.status]}`}>{t(`conversations.status.${conversation.status}`)}</span>
                {conversation.staffUnreadCount > 0 && (
                  <span aria-label={`${conversation.staffUnreadCount} ${t("conversations.filter.unread")}`} className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground tabular-nums">
                    {conversation.staffUnreadCount}
                  </span>
                )}
              </div>
            </button>
          )
        })}
        {!isLoading && !error && props.hasNextPage && (
          <Button variant="outline" className="w-full" disabled={props.isFetchingNextPage} onClick={props.onLoadMore}>
            {t("conversations.loadMore")}
          </Button>
        )}
      </div>
    </aside>
  )
}
