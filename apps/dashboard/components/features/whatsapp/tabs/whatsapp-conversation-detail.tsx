import { Button, Input, Label } from "@sawaa/ui"
import type { WhatsappConversationDetail } from "@/lib/types/whatsapp"
import { WhatsappMessageBubble } from "./whatsapp-message-bubble"
import { getWhatsappErrorMessage } from "./whatsapp-error-message"
import { WHATSAPP_STATUS_COLOR } from "./whatsapp-conversation-status"

interface WhatsappConversationDetailProps {
  detail: WhatsappConversationDetail | null
  detailError: unknown
  canManage: boolean
  replyText: string
  replyPending: boolean
  releasePending: boolean
  closePending: boolean
  replyError: string | null
  t: (key: string) => string
  onReplyTextChange: (value: string) => void
  onReply: () => void
  onRelease: () => void
  onClose: () => void
}

export function WhatsappConversationDetail({
  detail,
  detailError,
  canManage,
  replyText,
  replyPending,
  releasePending,
  closePending,
  replyError,
  t,
  onReplyTextChange,
  onReply,
  onRelease,
  onClose,
}: WhatsappConversationDetailProps) {
  if (detailError) {
    return (
      <section
        className="min-w-0 p-4 md:col-span-2 md:p-5"
        aria-label={t("whatsapp.conversations.title")}
      >
        <div
          role="alert"
          className="rounded-lg border border-error/30 bg-error-soft/40 p-3 text-sm text-error"
        >
          {getWhatsappErrorMessage(detailError, t)}
        </div>
      </section>
    )
  }

  if (!detail) {
    return (
      <section
        className="min-w-0 p-4 md:col-span-2 md:p-5"
        aria-label={t("whatsapp.conversations.title")}
      >
        <div className="flex min-h-[520px] flex-col items-center justify-center rounded-xl border border-dashed border-border-strong bg-surface-muted/20 px-6 text-center">
          <div
            className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-primary-ultra-light text-lg font-bold text-primary-dark"
            aria-hidden="true"
          >
            م
          </div>
          <p className="max-w-xs text-sm font-medium text-foreground">
            {t("whatsapp.conversations.empty")}
          </p>
          <p className="mt-1 max-w-sm text-xs leading-6 text-muted-foreground">
            {t("whatsapp.conversations.search")}
          </p>
        </div>
      </section>
    )
  }

  return (
    <section
      className="min-w-0 p-4 md:col-span-2 md:p-5"
      aria-label={t("whatsapp.conversations.title")}
    >
      <div className="flex min-h-[520px] flex-col">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/70 pb-4">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-foreground">
              {detail.contactName ?? detail.phone}
            </p>
            <p dir="ltr" className="mt-1 text-xs text-muted-foreground">
              {detail.phone}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span
              className={`rounded-md px-2 py-1 ${WHATSAPP_STATUS_COLOR[detail.status]}`}
            >
              {t(
                `whatsapp.conversations.col.status.${detail.status.toLowerCase()}`
              )}
            </span>
            <span className="rounded-md border border-border bg-surface-muted/40 px-2 py-1 text-muted-foreground">
              {t("whatsapp.conversations.col.messagesCount").replace(
                "{n}",
                String(detail.messages.length)
              )}
            </span>
            {detail.staffTakeover && (
              <span className="rounded-md bg-primary-ultra-light px-2 py-1 text-primary-dark">
                {t("whatsapp.conversations.detail.takenOver")}
              </span>
            )}
            {canManage && (
              <Button
                variant="outline"
                size="sm"
                onClick={onClose}
                disabled={closePending}
              >
                {t("whatsapp.conversations.detail.close")}
              </Button>
            )}
          </div>
        </div>
        <div
          dir="rtl"
          className="mt-4 max-h-[460px] min-h-[360px] flex-1 space-y-3 overflow-y-auto rounded-xl border border-border/70 bg-surface-muted/20 p-4"
        >
          {detail.messages.map((message) => (
            <WhatsappMessageBubble
              key={message.id}
              role={message.role}
              content={message.content}
              createdAt={message.createdAt}
              deliveryStatus={message.deliveryStatus}
              errorMessage={message.errorMessage}
              t={t}
            />
          ))}
        </div>

        {canManage && (
          <div className="mt-4 rounded-xl border border-border/70 bg-surface-muted/20 p-3">
            <Label
              htmlFor="reply"
              className="mb-2 block text-xs font-medium text-muted-foreground"
            >
              {t("whatsapp.conversations.detail.reply")}
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="reply"
                className="bg-surface-solid shadow-none"
                value={replyText}
                onChange={(e) => onReplyTextChange(e.target.value)}
                placeholder={t("whatsapp.conversations.detail.placeholder")}
              />
              <Button
                className="shrink-0"
                onClick={onReply}
                disabled={replyPending || !replyText.trim()}
              >
                {t("whatsapp.conversations.detail.send")}
              </Button>
            </div>
            {replyError && (
              <p role="alert" className="mt-2 text-xs text-error">
                {getWhatsappErrorMessage(replyError, t)}
              </p>
            )}
            {detail.staffTakeover && (
              <div className="mt-3 flex flex-wrap justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={onRelease}
                  disabled={releasePending}
                >
                  {t("whatsapp.conversations.detail.releaseTakeover")}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
