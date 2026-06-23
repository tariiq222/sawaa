"use client"

import { toast } from "sonner"

import { DataTable } from "@/components/features/data-table"
import { Skeleton } from "@sawaa/ui"
import { useLocale } from "@/components/locale-provider"
import {
  useKnowledgeBase,
  useChatbotMutations,
} from "@/hooks/use-chatbot"
import { getEntryColumns } from "./kb-entry-columns"
import { showApiError } from "@/lib/mutation-helpers"

export function KnowledgeBaseTab() {
  const { t } = useLocale()
  const { entries, loading: entriesLoading } = useKnowledgeBase()
  const { deleteKbEntryMut } = useChatbotMutations()

  const handleDeleteEntry = async (id: string) => {
    try {
      await deleteKbEntryMut.mutateAsync(id)
      toast.success(t("chatbot.kb.entryDeleted"))
    } catch (err) {
      showApiError(err, { fallback: t("chatbot.kb.deleteFailed"), t })
    }
  }

  const columns = getEntryColumns(handleDeleteEntry, t)

  if (entriesLoading) {
    return (
      <div className="flex flex-col gap-4 pt-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 pt-4">
      {/* Knowledge base entries (read-only) */}
      <DataTable
        columns={columns}
        data={entries}
        emptyTitle={t("chatbot.kb.empty")}
      />
      {/* Files upload و sync محذوفان مؤقتاً — endpoints غير جاهزة */}
    </div>
  )
}
