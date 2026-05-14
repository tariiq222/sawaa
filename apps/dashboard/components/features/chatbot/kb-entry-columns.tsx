"use client"

import { useState } from "react"
import { type ColumnDef } from "@tanstack/react-table"
import { HugeiconsIcon } from "@hugeicons/react"
import { Delete02Icon } from "@hugeicons/core-free-icons"

import { Badge } from "@deqah/ui"
import { Tooltip, TooltipContent, TooltipTrigger } from "@deqah/ui"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@deqah/ui"
import type { KnowledgeBaseEntry } from "@/lib/types/chatbot"

function DeleteEntryCell({
  id,
  onDelete,
  t,
}: {
  id: string
  onDelete: (id: string) => void
  t: (key: string) => string
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className="flex size-9 items-center justify-center rounded-sm border border-transparent text-muted-foreground transition-all duration-200 hover:border-destructive/20 hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setOpen(true)}
            aria-label={t("chatbot.kb.deleteEntry")}
          >
            <HugeiconsIcon icon={Delete02Icon} size={16} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">
          {t("chatbot.kb.deleteEntry")}
        </TooltipContent>
      </Tooltip>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("chatbot.kb.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("chatbot.kb.deleteConfirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="text-destructive-foreground bg-destructive hover:bg-destructive/90"
              onClick={() => {
                setOpen(false)
                onDelete(id)
              }}
            >
              {t("chatbot.kb.deleteEntry")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export function getEntryColumns(
  onDelete: (id: string) => void,
  t: (key: string) => string
): ColumnDef<KnowledgeBaseEntry, unknown>[] {
  return [
    {
      accessorKey: "title",
      header: t("chatbot.kb.col.title"),
      cell: ({ row }) => (
        <span className="text-sm font-medium text-foreground">
          {row.original.title}
        </span>
      ),
    },
    {
      accessorKey: "category",
      header: t("chatbot.kb.col.category"),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.category ?? "—"}
        </span>
      ),
    },
    {
      accessorKey: "source",
      header: t("chatbot.kb.col.source"),
      cell: ({ row }) => (
        <Badge variant="outline" className="text-xs">
          {row.original.source ?? "manual"}
        </Badge>
      ),
    },
    {
      accessorKey: "isActive",
      header: t("chatbot.kb.col.status"),
      cell: ({ row }) =>
        row.original.isActive ? (
          <Badge variant="default">{t("chatbot.kb.status.active")}</Badge>
        ) : (
          <Badge variant="secondary">{t("chatbot.kb.status.inactive")}</Badge>
        ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <DeleteEntryCell id={row.original.id} onDelete={onDelete} t={t} />
      ),
    },
  ]
}
