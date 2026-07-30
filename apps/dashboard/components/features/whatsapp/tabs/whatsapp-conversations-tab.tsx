"use client"

import { useMemo, useState } from "react"
import {
  Button,
  Input,
  Label,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@sawaa/ui"
import { useLocale } from "@/components/locale-provider"
import {
  useWhatsappConversation,
  useWhatsappConversations,
} from "@/hooks/use-whatsapp"
import {
  useCloseWhatsappConversation,
  useStaffReply,
} from "@/hooks/use-whatsapp-mutations"
import type { WhatsappConversationStatus } from "@/lib/types/whatsapp"
import { WhatsappMessageBubble } from "./whatsapp-message-bubble"

const STATUS_COLOR: Record<WhatsappConversationStatus, string> = {
  ACTIVE: "bg-success/10 text-success",
  COMPLETED: "bg-muted text-muted-foreground",
  ABANDONED: "bg-warning/10 text-warning",
  TAKEOVER: "bg-primary/10 text-primary",
  BLOCKED: "bg-error/10 text-error",
}

const PAGE_SIZE = 20

export function WhatsappConversationsTab() {
  const { t, locale } = useLocale()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<WhatsappConversationStatus | "ALL">("ALL")
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const { data, total, loading, error, refetch } = useWhatsappConversations({
    page,
    pageSize: PAGE_SIZE,
    status: statusFilter === "ALL" ? undefined : statusFilter,
    search: search.trim() || undefined,
  })
  const { detail, error: detailError } = useWhatsappConversation(selectedId)
  const reply = useStaffReply(selectedId ?? "")
  const close = useCloseWhatsappConversation()
  const [replyText, setReplyText] = useState("")
  const [replyError, setReplyError] = useState<string | null>(null)

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / PAGE_SIZE)),
    [total],
  )

  const onReply = async () => {
    if (!replyText.trim()) return
    setReplyError(null)
    try {
      const res = await reply.mutateAsync({ message: replyText.trim() })
      if (!res.ok) {
        setReplyError(res.error ?? t("whatsapp.conversations.detail.sendFailed"))
        return
      }
      setReplyText("")
    } catch (e: unknown) {
      setReplyError(e instanceof Error ? e.message : t("whatsapp.conversations.detail.sendFailed"))
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {t("whatsapp.conversations.title")} ({total})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <div
            role="alert"
            className="mb-4 rounded-md border border-error/30 bg-error/5 p-3 text-sm text-error"
          >
              {t("whatsapp.conversations.loadError").replace(
                "{error}",
                (error as unknown as Error)?.message ?? String(error),
              )}
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

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="space-y-3">
            <Input
              placeholder={t("whatsapp.conversations.search")}
              aria-label={t("whatsapp.conversations.search")}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
            />
            <div className="flex flex-wrap gap-2" role="group" aria-label={t("whatsapp.conversations.filter.label")}>
              {(["ALL", "ACTIVE", "TAKEOVER", "COMPLETED"] as const).map((s) => (
                <button
                  type="button"
                  key={s}
                  aria-pressed={statusFilter === s}
                  onClick={() => {
                    setStatusFilter(s)
                    setPage(1)
                  }}
                  className={`rounded-md border px-2 py-1 text-xs transition ${
                    statusFilter === s
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border"
                  }`}
                >
                  {s === "ALL"
                    ? t("whatsapp.conversations.filter.all")
                    : t(`whatsapp.conversations.filter.${s.toLowerCase()}`)}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              {loading && (
                <p className="text-sm text-muted-foreground">
                  {t("whatsapp.conversations.loading")}
                </p>
              )}
              {!loading && data.length === 0 && !error && (
                <p className="text-sm text-muted-foreground">
                  {t("whatsapp.conversations.empty")}
                </p>
              )}
              {data.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={`w-full rounded-md border p-3 text-start text-sm transition ${
                    selectedId === c.id ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span dir="ltr" className="font-mono">{c.phone}</span>
                    <span className={`rounded-md px-2 py-0.5 text-xs ${STATUS_COLOR[c.status]}`}>
                      {t(`whatsapp.conversations.col.status.${c.status.toLowerCase()}`)}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                    {c.lastMessagePreview ?? "—"}
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {new Date(c.lastMessageAt).toLocaleString(locale)}
                  </p>
                </button>
              ))}

              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-2 text-xs">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
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
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    {t("whatsapp.conversations.next")}
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="md:col-span-2 space-y-4">
            {!selectedId && (
              <p className="text-sm text-muted-foreground">
                {t("whatsapp.conversations.empty")}
              </p>
            )}
            {selectedId && detailError && (
              <div
                role="alert"
                className="rounded-md border border-error/30 bg-error/5 p-3 text-sm text-error"
              >
                {t("whatsapp.conversations.detailLoadError").replace(
                  "{error}",
                  (detailError as unknown as Error)?.message ?? String(detailError),
                )}
              </div>
            )}
            {detail && (
              <>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className={`rounded-md px-2 py-0.5 ${STATUS_COLOR[detail.status]}`}>
                    {t(`whatsapp.conversations.col.status.${detail.status.toLowerCase()}`)}
                  </span>
                  <span className="rounded-md border px-2 py-0.5 text-muted-foreground">
                    {t("whatsapp.conversations.col.messagesCount").replace(
                      "{n}",
                      String(detail.messages.length),
                    )}
                  </span>
                  {detail.staffTakeover && (
                    <span className="rounded-md bg-primary/10 px-2 py-0.5 text-primary">
                      {t("whatsapp.conversations.detail.takenOver")}
                    </span>
                  )}
                </div>
                <div
                  dir="ltr"
                  className="max-h-[420px] space-y-3 overflow-y-auto rounded-md border p-3"
                >
                  {detail.messages.map((m) => (
                    <WhatsappMessageBubble
                      key={m.id}
                      role={m.role}
                      content={m.content}
                      createdAt={m.createdAt}
                      t={t}
                    />
                  ))}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reply">
                    {t("whatsapp.conversations.detail.reply")}
                  </Label>
                  <Input
                    id="reply"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder={t("whatsapp.conversations.detail.placeholder")}
                  />
                  {replyError && (
                    <p role="alert" className="text-xs text-error">
                      {replyError}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={onReply}
                      disabled={reply.isPending || !replyText.trim()}
                    >
                      {t("whatsapp.conversations.detail.send")}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (detail) close.mutate(detail.id)
                        setSelectedId(null)
                      }}
                      disabled={close.isPending}
                    >
                      {t("whatsapp.conversations.detail.close")}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
