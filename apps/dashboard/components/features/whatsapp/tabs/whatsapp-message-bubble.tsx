import type { WhatsappMessageRole } from "@/lib/types/whatsapp"

interface WhatsappMessageBubbleProps {
  role: WhatsappMessageRole
  content: string
  createdAt: string
  t: (key: string) => string
}

export function WhatsappMessageBubble({
  role,
  content,
  createdAt,
  t,
}: WhatsappMessageBubbleProps) {
  const isUser = role === "USER"
  const isStaff = role === "STAFF"
  const align = isUser ? "items-start" : "items-end"
  const bubbleColor = isUser
    ? "bg-muted"
    : isStaff
      ? "bg-primary/10 text-primary"
      : "bg-surface"
  const roleLabel = t(`whatsapp.conversations.col.role.${role.toLowerCase()}`)

  return (
    <div className={`flex flex-col ${align} gap-1`}>
      <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${bubbleColor}`}>
        {content}
      </div>
      <span className="text-[10px] text-muted-foreground">
        {roleLabel} · {new Date(createdAt).toLocaleTimeString()}
      </span>
    </div>
  )
}
