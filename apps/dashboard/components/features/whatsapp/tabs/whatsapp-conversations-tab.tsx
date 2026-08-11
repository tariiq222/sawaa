"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Button, Card, CardContent, CardHeader, CardTitle } from "@sawaa/ui"
import { useLocale } from "@/components/locale-provider"
import { useAuth } from "@/components/providers/auth-provider"
import {
  useWhatsappConversation,
  useWhatsappConversations,
  useWhatsappStatus,
} from "@/hooks/use-whatsapp"
import {
  useCloseWhatsappConversation,
  useMarkWhatsappConversationRead,
  useReleaseWhatsappTakeover,
  useStaffReply,
} from "@/hooks/use-whatsapp-mutations"
import type { WhatsappConversationStatus } from "@/lib/types/whatsapp"
import { WhatsappConversationDetail } from "./whatsapp-conversation-detail"
import { WhatsappConversationList } from "./whatsapp-conversation-list"
import { getWhatsappErrorMessage } from "./whatsapp-error-message"

const PAGE_SIZE = 20

export function WhatsappConversationsTab() {
  const { t } = useLocale()
  const router = useRouter()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<
    WhatsappConversationStatus | "ALL"
  >("ALL")
  const [bookingFilter, setBookingFilter] = useState<
    "ALL" | "BOOKED" | "NOT_BOOKED"
  >("ALL")
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [failedOnly, setFailedOnly] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [replyText, setReplyText] = useState("")
  const [replyError, setReplyError] = useState<string | null>(null)

  const { data, total, loading, error, refetch } = useWhatsappConversations({
    page,
    pageSize: PAGE_SIZE,
    status: statusFilter === "ALL" ? undefined : statusFilter,
    bookingFilter: bookingFilter === "ALL" ? undefined : bookingFilter,
    search: search.trim() || undefined,
    unread: unreadOnly || undefined,
    deliveryFailure: failedOnly || undefined,
  })
  const { detail, error: detailError } = useWhatsappConversation(selectedId)
  const { status } = useWhatsappStatus()
  const reply = useStaffReply(selectedId ?? "")
  const close = useCloseWhatsappConversation()
  const markRead = useMarkWhatsappConversationRead()
  const release = useReleaseWhatsappTakeover()
  const { canDo } = useAuth()
  const canManage = canDo("whatsappconversation", "manage")

  useEffect(() => {
    if (!detail || !detail.unreadCount || markRead.isPending) return
    const lastUserMessage = [...detail.messages]
      .reverse()
      .find((message) => message.role === "USER")
    markRead.mutate({ id: detail.id, throughMessageId: lastUserMessage?.id })
  }, [detail, markRead])

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / PAGE_SIZE)),
    [total]
  )

  const resetPage = () => setPage(1)
  const onReply = async () => {
    if (!replyText.trim()) return
    setReplyError(null)
    try {
      const res = await reply.mutateAsync({ message: replyText.trim() })
      if (!res.ok) {
        setReplyError(getWhatsappErrorMessage(res.error, t))
        return
      }
      setReplyText("")
    } catch (e: unknown) {
      setReplyError(getWhatsappErrorMessage(e, t))
    }
  }

  return (
    <Card className="overflow-hidden border-border/80 shadow-sm">
      <CardHeader className="border-b border-border/70 bg-surface-muted/30 px-5 py-4">
        <CardTitle className="flex items-center gap-2">
          <span>{t("whatsapp.conversations.title")}</span>
          <span className="rounded-full bg-primary-ultra-light px-2 py-0.5 text-xs font-semibold text-primary-dark tabular-nums">
            {total}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {status && !status.isConnected && (
          <div
            role="alert"
            className="m-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning"
          >
            <span>{t("whatsapp.conversations.connectionWarning")}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/settings?tab=whatsapp")}
            >
              {t("whatsapp.conversations.openConnection")}
            </Button>
          </div>
        )}
        {error && (
          <div
            role="alert"
            className="m-4 rounded-lg border border-error/30 bg-error-soft/40 p-3 text-sm text-error"
          >
            {getWhatsappErrorMessage(error, t)}
            <Button
              variant="outline"
              size="sm"
              className="ms-3"
              onClick={() => refetch()}
            >
              {t("whatsapp.conversations.retry")}
            </Button>
          </div>
        )}

        <div className="grid min-h-[620px] grid-cols-1 md:grid-cols-3">
          <WhatsappConversationList
            data={data}
            loading={loading}
            totalPages={totalPages}
            page={page}
            search={search}
            statusFilter={statusFilter}
            bookingFilter={bookingFilter}
            unreadOnly={unreadOnly}
            failedOnly={failedOnly}
            selectedId={selectedId}
            t={t}
            onSearchChange={(value) => {
              setSearch(value)
              resetPage()
            }}
            onStatusChange={(value) => {
              setStatusFilter(value)
              resetPage()
            }}
            onBookingChange={(value) => {
              setBookingFilter(value)
              resetPage()
            }}
            onUnreadChange={() => {
              setUnreadOnly((value) => !value)
              resetPage()
            }}
            onFailedChange={() => {
              setFailedOnly((value) => !value)
              resetPage()
            }}
            onSelect={setSelectedId}
            onPageChange={setPage}
          />
          <WhatsappConversationDetail
            detail={detail ?? null}
            detailError={detailError}
            canManage={canManage}
            replyText={replyText}
            replyPending={reply.isPending}
            releasePending={release.isPending}
            closePending={close.isPending}
            replyError={replyError}
            t={t}
            onReplyTextChange={setReplyText}
            onReply={onReply}
            onRelease={() => release.mutate(detail?.id ?? "")}
            onClose={() => close.mutate(detail?.id ?? "")}
          />
        </div>
      </CardContent>
    </Card>
  )
}
