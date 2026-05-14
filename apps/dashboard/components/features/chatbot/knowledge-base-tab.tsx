"use client"

import { useState, useRef } from "react"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Upload04Icon,
  Add01Icon,
  ArrowReloadHorizontalIcon,
} from "@hugeicons/core-free-icons"

import { DataTable } from "@/components/features/data-table"
import { Button } from "@deqah/ui"
import { Skeleton } from "@deqah/ui"
import { Card, CardContent, CardHeader, CardTitle } from "@deqah/ui"
import { useLocale } from "@/components/locale-provider"
import {
  useKnowledgeBase,
  useKnowledgeFiles,
  useChatbotMutations,
} from "@/hooks/use-chatbot"
import { CreateKbEntryDialog } from "./create-kb-entry-dialog"
import { getEntryColumns } from "./kb-entry-columns"
import { KbFileRow } from "./kb-file-row"

export function KnowledgeBaseTab() {
  const { t } = useLocale()
  const { entries, loading: entriesLoading } = useKnowledgeBase()
  const { files, loading: filesLoading } = useKnowledgeFiles()
  const {
    deleteKbEntryMut,
    syncKbMut,
    uploadFileMut,
    processFileMut,
    deleteFileMut,
  } = useChatbotMutations()

  const [createOpen, setCreateOpen] = useState(false)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDeleteEntry = async (id: string) => {
    try {
      await deleteKbEntryMut.mutateAsync(id)
      toast.success(t("chatbot.kb.entryDeleted"))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("chatbot.kb.deleteFailed"))
    }
  }

  const handleSync = async () => {
    try {
      const result = await syncKbMut.mutateAsync()
      toast.success(t("chatbot.kb.syncedCount").replace("{n}", String(result.synced)))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("chatbot.kb.syncFailed"))
    }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      await uploadFileMut.mutateAsync(file)
      toast.success(t("chatbot.kb.fileUploaded"))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("chatbot.kb.uploadFailed"))
    }
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const handleProcessFile = async (id: string) => {
    setProcessingId(id)
    try {
      await processFileMut.mutateAsync(id)
      toast.success(t("chatbot.kb.fileProcessed"))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("chatbot.kb.processFailed"))
    }
    setProcessingId(null)
  }

  const handleDeleteFile = async (id: string) => {
    setDeletingFileId(id)
    try {
      await deleteFileMut.mutateAsync(id)
      toast.success(t("chatbot.kb.fileDeleted"))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("chatbot.kb.deleteFailed"))
    }
    setDeletingFileId(null)
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
      {/* Actions bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <HugeiconsIcon icon={Add01Icon} size={14} />
          {t("chatbot.kb.addEntry")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSync}
          disabled={syncKbMut.isPending}
        >
          <HugeiconsIcon icon={ArrowReloadHorizontalIcon} size={14} />
          {syncKbMut.isPending ? t("chatbot.kb.syncing") : t("chatbot.kb.sync")}
        </Button>
      </div>

      {/* Entries table */}
      <DataTable
        columns={columns}
        data={entries}
        emptyTitle={t("chatbot.kb.empty")}
      />

      {/* Files section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-semibold">{t("chatbot.kb.filesTitle")}</CardTitle>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleUpload}
              accept=".txt,.pdf,.md,.csv,.json"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadFileMut.isPending}
            >
              <HugeiconsIcon icon={Upload04Icon} size={14} />
              {uploadFileMut.isPending
                ? t("chatbot.kb.uploading")
                : t("chatbot.kb.uploadFile")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {filesLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : files.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t("chatbot.kb.noFiles")}
            </p>
          ) : (
            files.map((file) => (
              <KbFileRow
                key={file.id}
                file={file}
                onProcess={handleProcessFile}
                onDelete={handleDeleteFile}
                processingId={processingId}
                deletingId={deletingFileId}
              />
            ))
          )}
        </CardContent>
      </Card>

      <CreateKbEntryDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  )
}
