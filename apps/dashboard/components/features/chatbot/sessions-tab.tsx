"use client"

import { useState } from "react"
import { type ColumnDef } from "@tanstack/react-table"

import { DataTable } from "@/components/features/data-table"
import { Badge } from "@deqah/ui"
import { Skeleton } from "@deqah/ui"
import { useLocale } from "@/components/locale-provider"
import { formatDatePattern } from "@/lib/date"
import { useChatSessions } from "@/hooks/use-chatbot"
import { SessionDetailSheet } from "./session-detail-sheet"
import type { ChatSession } from "@/lib/types/chatbot"

/* ─── Helpers ─── */

function shortId(id: string): string {
  return id.slice(0, 8)
}

function formatDuration(startedAt: string, endedAt: string | null): string {
  const start = new Date(startedAt).getTime()
  const end = endedAt ? new Date(endedAt).getTime() : Date.now()
  const diffMs = end - start
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  return `${hrs}h ${mins % 60}m`
}

/* ─── Columns ─── */

function getColumns(
  onRowClick: (id: string) => void,
  t: (key: string) => string,
): ColumnDef<ChatSession, unknown>[] {
  return [
    {
      accessorKey: "id",
      header: t("chatbot.col.id"),
      cell: ({ row }) => (
        <button
          type="button"
          onClick={() => onRowClick(row.original.id)}
          className="font-mono text-xs text-primary hover:underline tabular-nums"
        >
          {shortId(row.original.id)}
        </button>
      ),
    },
    {
      accessorKey: "user",
      header: t("chatbot.col.user"),
      cell: ({ row }) => {
        const u = row.original.user
        return (
          <span className="text-sm text-foreground">
            {u.firstName} {u.lastName}
          </span>
        )
      },
    },
    {
      accessorKey: "handedOff",
      header: t("chatbot.col.status"),
      cell: ({ row }) => {
        const active = !row.original.endedAt
        const handedOff = row.original.handedOff
        if (handedOff) {
          return <Badge variant="destructive">{t("chatbot.status.handedOff")}</Badge>
        }
        return active ? (
          <Badge variant="default">{t("chatbot.status.active")}</Badge>
        ) : (
          <Badge variant="secondary">{t("chatbot.status.ended")}</Badge>
        )
      },
    },
    {
      accessorKey: "_count.messages",
      header: t("chatbot.col.messages"),
      cell: ({ row }) => (
        <span className="tabular-nums">
          {row.original._count.messages}
        </span>
      ),
    },
    {
      accessorKey: "language",
      header: t("chatbot.col.language"),
      cell: ({ row }) => (
        <span className="text-sm uppercase">
          {row.original.language ?? "—"}
        </span>
      ),
    },
    {
      accessorKey: "startedAt",
      header: t("chatbot.col.startedAt"),
      cell: ({ row }) => (
        <span className="text-sm tabular-nums text-muted-foreground">
          {formatDatePattern(row.original.startedAt, "MMM d, yyyy HH:mm")}
        </span>
      ),
    },
    {
      id: "duration",
      header: t("chatbot.col.duration"),
      cell: ({ row }) => (
        <span className="text-sm tabular-nums text-muted-foreground">
          {formatDuration(row.original.startedAt, row.original.endedAt)}
        </span>
      ),
    },
  ]
}

/* ─── Component ─── */

export function SessionsTab() {
  const { t } = useLocale()
  const { sessions, loading } = useChatSessions()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const columns = getColumns(setSelectedId, t)

  if (loading) {
    return (
      <div className="flex flex-col gap-4 pt-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 pt-4">
      <DataTable
        columns={columns}
        data={sessions}
        emptyTitle={t("chatbot.sessions.empty")}
      />

      <SessionDetailSheet
        sessionId={selectedId}
        open={!!selectedId}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null)
        }}
      />
    </div>
  )
}
