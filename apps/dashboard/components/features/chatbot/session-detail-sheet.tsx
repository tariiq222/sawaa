"use client"

import { useState } from "react"
import { toast } from "sonner"

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetBody,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@deqah/ui"
import { Badge } from "@deqah/ui"
import { Button } from "@deqah/ui"
import { Input } from "@deqah/ui"
import { Skeleton } from "@deqah/ui"
import { useChatSession, useChatbotMutations } from "@/hooks/use-chatbot"
import { useLocale } from "@/components/locale-provider"
import { formatDatePattern } from "@/lib/date"
import { cn } from "@/lib/utils"
import type { ChatMessage } from "@/lib/types/chatbot"

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
  const isSystem = message.role === "system"

  const roleBadge: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
    user: { label: t("chatbot.role.client"), variant: "default" },
    assistant: { label: t("chatbot.role.bot"), variant: "secondary" },
    system: { label: t("chatbot.role.system"), variant: "outline" },
    staff: { label: t("chatbot.role.staff"), variant: "destructive" },
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
              : isSystem
                ? "bg-muted text-muted-foreground"
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
  const { session, loading, refetch } = useChatSession(sessionId ?? "")
  const { endSessionMut, staffMsgMut } = useChatbotMutations()
  const [staffMsg, setStaffMsg] = useState("")

  const isActive = session ? !session.endedAt : false
  const isLiveChat = session?.handedOff && session?.handoffType === "live_chat"
  const canReply = isActive && isLiveChat

  const handleEndSession = async () => {
    if (!sessionId) return
    try {
      await endSessionMut.mutateAsync(sessionId)
      toast.success(t("chatbot.sessionEnded"))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("chatbot.sessionEndError"))
    }
  }

  const handleSendStaff = async () => {
    if (!sessionId || !staffMsg.trim()) return
    try {
      await staffMsgMut.mutateAsync({ sessionId, content: staffMsg.trim() })
      setStaffMsg("")
      refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("chatbot.sendError"))
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
              {isLiveChat && (
                <Badge variant="destructive" className="text-[10px]">
                  {t("chatbot.liveChat")}
                </Badge>
              )}
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
            {/* Staff reply input — only for live chat sessions */}
            {canReply && (
              <div className="flex items-center gap-2">
                <Input
                  value={staffMsg}
                  onChange={(e) => setStaffMsg(e.target.value)}
                  placeholder={t("chatbot.staffReplyPlaceholder")}
                  onKeyDown={(e) => e.key === "Enter" && handleSendStaff()}
                  disabled={staffMsgMut.isPending}
                  className="flex-1"
                />
                <Button
                  size="sm"
                  onClick={handleSendStaff}
                  disabled={staffMsgMut.isPending || !staffMsg.trim()}
                >
                  {staffMsgMut.isPending ? t("chatbot.sending") : t("chatbot.send")}
                </Button>
              </div>
            )}
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
