"use client"

import { toast } from "sonner"

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetBody,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@sawaa/ui"
import { Badge } from "@sawaa/ui"
import { Button } from "@sawaa/ui"
import { Skeleton } from "@sawaa/ui"
import { useChatSession, useChatbotMutations } from "@/hooks/use-chatbot"
import { useLocale } from "@/components/locale-provider"
import { formatDatePattern } from "@/lib/date"
import { cn } from "@/lib/utils"
import type { ChatMessage } from "@/lib/types/chatbot"
import { showApiError } from "@/lib/mutation-helpers"

/* ─── Props ─── */

interface SessionDetailSheetProps {
  sessionId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/* ─── Message Bubble ─── */

function MessageBubble({
  message,
  t,
}: {
  message: ChatMessage
  t: (key: string) => string
}) {
  const isUser = message.role === "user"
  const isStaff = message.role === "staff"
  // The documented role vocabulary is `user | staff | assistant`; this route
  // never sends `system`, so only the two reachable styles remain.

  const roleBadge: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
    user: { label: t("chatbot.role.client"), variant: "default" },
    assistant: { label: t("chatbot.role.bot"), variant: "secondary" },
    system: { label: t("chatbot.role.system"), variant: "outline" },
    staff: { label: t("chatbot.role.staff"), variant: "secondary" },
  }

  const badge = roleBadge[message.role] ?? roleBadge.system

  return (
    <div
      className={cn(
        "flex flex-col gap-1 max-w-[80%]",
        isUser ? "ms-auto items-end" : isStaff ? "ms-auto items-end" : "me-auto items-start",
      )}
    >
      <Badge variant={badge.variant} className="text-[10px]">
        {badge.label}
      </Badge>
      <div
        className={cn(
          "rounded-lg px-3 py-2 text-sm",
          isUser
            ? "bg-primary text-primary-foreground"
            : isStaff
              ? "bg-success/10 border border-success/20 text-foreground"
              : "bg-card border text-foreground",
        )}
      >
        {message.content}
      </div>
      <span className="text-[10px] text-muted-foreground tabular-nums">
        {formatDatePattern(message.createdAt, "HH:mm:ss")}
      </span>
    </div>
  )
}

/* ─── Loading Skeleton ─── */

function SheetSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-20 w-3/4" />
      <Skeleton className="ms-auto h-20 w-3/4" />
      <Skeleton className="h-20 w-3/4" />
    </div>
  )
}

/* ─── Component ─── */

export function SessionDetailSheet({
  sessionId,
  open,
  onOpenChange,
}: SessionDetailSheetProps) {
  const { t } = useLocale()
  const { session, loading } = useChatSession(sessionId ?? "")
  const { endSessionMut } = useChatbotMutations()

  const isActive = session ? !session.endedAt : false
  /*
   * The previous `handoffType === "live_chat"` check was a dead read: the
   * dashboard chat detail route (`GetConversationHandler`) never sends
   * `handoffType`, so the staff reply box has never rendered. Turning that into
   * a live value would change behaviour, so the dead branch was removed and the
   * reply UI stays absent exactly as before.
   */

  const handleEndSession = async () => {
    if (!sessionId) return
    try {
      await endSessionMut.mutateAsync(sessionId)
      toast.success(t("chatbot.sessionEnded"))
    } catch (err) {
      showApiError(err, { fallback: t("chatbot.sessionEndError"), t })
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="end">
        <SheetHeader>
          <SheetTitle>
            {t("chatbot.session")} {sessionId ? sessionId.slice(0, 8) : ""}
          </SheetTitle>
          {session && (
            <SheetDescription className="flex items-center gap-2">
              <span>{session.user.firstName} {session.user.lastName}</span>
            </SheetDescription>
          )}
        </SheetHeader>

        <SheetBody>
          {loading ? (
            <SheetSkeleton />
          ) : session ? (
            <div className="flex flex-col gap-3">
              {session.messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} t={t} />
              ))}
              {session.messages.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {t("chatbot.noMessages")}
                </p>
              )}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t("chatbot.sessionNotFound")}
            </p>
          )}
        </SheetBody>

        <SheetFooter>
          <div className="flex flex-col gap-2 w-full">
            {isActive && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleEndSession}
                disabled={endSessionMut.isPending}
              >
                {endSessionMut.isPending ? t("chatbot.ending") : t("chatbot.endSession")}
              </Button>
            )}
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
