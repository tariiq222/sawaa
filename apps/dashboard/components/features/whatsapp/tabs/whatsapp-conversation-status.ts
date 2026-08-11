import type { WhatsappConversationStatus } from "@/lib/types/whatsapp"

export const WHATSAPP_STATUS_COLOR: Record<WhatsappConversationStatus, string> =
  {
    ACTIVE: "bg-success-soft text-success",
    COMPLETED: "bg-muted text-muted-foreground",
    ABANDONED: "bg-warning-soft text-warning",
    TAKEOVER: "bg-primary-ultra-light text-primary-dark",
    BLOCKED: "bg-error-soft text-error",
  }
