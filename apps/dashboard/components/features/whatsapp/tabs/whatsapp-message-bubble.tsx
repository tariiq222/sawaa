import type { WhatsappMessageRole } from "@/lib/types/whatsapp"
import { getWhatsappErrorMessage } from "./whatsapp-error-message"

interface WhatsappMessageBubbleProps {
  role: WhatsappMessageRole
  content: string
  createdAt: string
  deliveryStatus?: string | null
  errorMessage?: string | null
  t: (key: string) => string
}

export function WhatsappMessageBubble({
  role,
  content,
  createdAt,
  deliveryStatus,
  errorMessage,
  t,
}: WhatsappMessageBubbleProps) {
  const isUser = role === "USER"
  const isStaff = role === "STAFF"
  const align = isUser ? "items-start" : "items-end"
  const bubbleColor = isUser
    ? "bg-muted"
    : isStaff
      ? "bg-primary/10 text-primary"
      : "border border-border/70 bg-surface-neutral text-foreground"
  const roleLabel = t(`whatsapp.conversations.col.role.${role.toLowerCase()}`)

  return (
    <div className={`flex flex-col ${align} gap-1`}>
      <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${bubbleColor}`}>
        {content}
      </div>
      <span className="text-[10px] text-muted-foreground">
        {roleLabel} · {new Date(createdAt).toLocaleTimeString()}
        {deliveryStatus === "FAILED" && ` · ${t("whatsapp.conversations.detail.failed")}`}
        {deliveryStatus === "PENDING" && ` · ${t("whatsapp.conversations.detail.pending")}`}
      </span>
      {deliveryStatus === "FAILED" && errorMessage && (
        <span className="max-w-[80%] text-[10px] text-error">
          {getWhatsappErrorMessage(errorMessage, t)}
        </span>
      )}
    </div>
  )
}
