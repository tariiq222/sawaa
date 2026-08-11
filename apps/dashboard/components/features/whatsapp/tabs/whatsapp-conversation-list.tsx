import { Button, Input } from "@sawaa/ui"
import type {
  WhatsappConversationStatus,
  WhatsappConversationSummary,
} from "@/lib/types/whatsapp"
import { WHATSAPP_STATUS_COLOR } from "./whatsapp-conversation-status"

function formatConversationDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Riyadh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date)
}

interface WhatsappConversationListProps {
  data: WhatsappConversationSummary[]
  loading: boolean
  totalPages: number
  page: number
  search: string
  statusFilter: WhatsappConversationStatus | "ALL"
  bookingFilter: "ALL" | "BOOKED" | "NOT_BOOKED"
  unreadOnly: boolean
  failedOnly: boolean
  selectedId: string | null
  t: (key: string) => string
  onSearchChange: (value: string) => void
  onStatusChange: (value: WhatsappConversationStatus | "ALL") => void
  onBookingChange: (value: "ALL" | "BOOKED" | "NOT_BOOKED") => void
  onUnreadChange: () => void
  onFailedChange: () => void
  onSelect: (id: string) => void
  onPageChange: (page: number) => void
}

export function WhatsappConversationList({
  data,
  loading,
  totalPages,
  page,
  search,
  statusFilter,
  bookingFilter,
  unreadOnly,
  failedOnly,
  selectedId,
  t,
  onSearchChange,
  onStatusChange,
  onBookingChange,
  onUnreadChange,
  onFailedChange,
  onSelect,
  onPageChange,
}: WhatsappConversationListProps) {
  return (
    <aside className="min-w-0 border-b border-border/70 bg-surface-muted/20 p-4 md:border-e md:border-b-0 md:p-5">
      <div className="mb-4 space-y-3">
        <Input
          className="h-10 bg-surface-solid shadow-none"
          placeholder={t("whatsapp.conversations.search")}
          aria-label={t("whatsapp.conversations.search")}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        <div
          className="flex flex-wrap gap-1.5"
          role="group"
          aria-label={t("whatsapp.conversations.filter.label")}
        >
          {(["ALL", "ACTIVE", "TAKEOVER", "COMPLETED"] as const).map(
            (status) => (
              <button
                type="button"
                key={status}
                aria-pressed={statusFilter === status}
                onClick={() => onStatusChange(status)}
                className={`min-h-8 rounded-md border px-2.5 py-1 text-xs transition-[background-color,border-color,color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none active:scale-[0.98] ${
                  statusFilter === status
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-border bg-surface-solid text-muted-foreground hover:border-primary/50 hover:text-foreground"
                }`}
              >
                {status === "ALL"
                  ? t("whatsapp.conversations.filter.all")
                  : t(`whatsapp.conversations.filter.${status.toLowerCase()}`)}
              </button>
            )
          )}
          <button
            type="button"
            aria-pressed={unreadOnly}
            onClick={onUnreadChange}
            className={`min-h-8 rounded-md border px-2.5 py-1 text-xs transition-[background-color,border-color,color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none active:scale-[0.98] ${unreadOnly ? "border-primary bg-primary text-primary-foreground shadow-sm" : "border-border bg-surface-solid text-muted-foreground hover:border-primary/50 hover:text-foreground"}`}
          >
            {t("whatsapp.conversations.filter.unread")}
          </button>
          <button
            type="button"
            aria-pressed={failedOnly}
            onClick={onFailedChange}
            className={`min-h-8 rounded-md border px-2.5 py-1 text-xs transition-[background-color,border-color,color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none active:scale-[0.98] ${failedOnly ? "border-error bg-error text-primary-foreground shadow-sm" : "border-border bg-surface-solid text-muted-foreground hover:border-error/50 hover:text-foreground"}`}
          >
            {t("whatsapp.conversations.filter.failed")}
          </button>
          <button
            type="button"
            aria-pressed={bookingFilter === "BOOKED"}
            onClick={() =>
              onBookingChange(bookingFilter === "BOOKED" ? "ALL" : "BOOKED")
            }
            className={`min-h-8 rounded-md border px-2.5 py-1 text-xs transition-[background-color,border-color,color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none active:scale-[0.98] ${bookingFilter === "BOOKED" ? "border-primary bg-primary text-primary-foreground shadow-sm" : "border-border bg-surface-solid text-muted-foreground hover:border-primary/50 hover:text-foreground"}`}
          >
            {t("whatsapp.conversations.filter.booked")}
          </button>
          <button
            type="button"
            aria-pressed={bookingFilter === "NOT_BOOKED"}
            onClick={() =>
              onBookingChange(
                bookingFilter === "NOT_BOOKED" ? "ALL" : "NOT_BOOKED"
              )
            }
            className={`min-h-8 rounded-md border px-2.5 py-1 text-xs transition-[background-color,border-color,color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none active:scale-[0.98] ${bookingFilter === "NOT_BOOKED" ? "border-primary bg-primary text-primary-foreground shadow-sm" : "border-border bg-surface-solid text-muted-foreground hover:border-primary/50 hover:text-foreground"}`}
          >
            {t("whatsapp.conversations.filter.notBooked")}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {loading && (
          <p className="text-sm text-muted-foreground">
            {t("whatsapp.conversations.loading")}
          </p>
        )}
        {!loading && data.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {t("whatsapp.conversations.empty")}
          </p>
        )}
        {data.map((conversation) => (
          <button
            type="button"
            key={conversation.id}
            aria-pressed={selectedId === conversation.id}
            onClick={() => onSelect(conversation.id)}
            className={`w-full rounded-lg border p-3 text-start text-sm transition-[background-color,border-color,box-shadow,transform] focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none active:scale-[0.995] ${
              selectedId === conversation.id
                ? "border-primary bg-surface-solid shadow-sm ring-1 ring-primary/20"
                : "border-border/80 bg-surface-solid/70 hover:-translate-y-px hover:border-primary/40 hover:shadow-sm"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 flex-1 truncate font-medium">
                {conversation.clientName ??
                  conversation.contactName ??
                  conversation.phone}
              </span>
              <div className="flex shrink-0 items-center gap-2">
                {conversation.unreadCount > 0 && (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] text-primary-foreground">
                    {conversation.unreadCount}
                  </span>
                )}
                <span
                  className={`rounded-md px-2 py-0.5 text-xs ${WHATSAPP_STATUS_COLOR[conversation.status]}`}
                >
                  {t(
                    `whatsapp.conversations.col.status.${conversation.status.toLowerCase()}`
                  )}
                </span>
                <span
                  dir="ltr"
                  className="text-[10px] whitespace-nowrap text-muted-foreground"
                >
                  {formatConversationDate(conversation.lastMessageAt)}
                </span>
              </div>
            </div>
            {(conversation.clientName ?? conversation.contactName) && (
              <p
                dir="ltr"
                className="mt-1 line-clamp-1 text-xs text-muted-foreground"
              >
                {conversation.phone}
              </p>
            )}
            <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
              {conversation.lastMessagePreview ?? "—"}
            </p>
          </button>
        ))}

        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2 text-xs">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              {t("whatsapp.conversations.prev")}
            </Button>
            <span className="text-muted-foreground">
              {t("whatsapp.conversations.page")
                .replace("{page}", String(page))
                .replace("{total}", String(totalPages))}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              {t("whatsapp.conversations.next")}
            </Button>
          </div>
        )}
      </div>
    </aside>
  )
}
