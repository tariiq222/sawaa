import { HugeiconsIcon } from "@hugeicons/react"
import { Delete02Icon } from "@hugeicons/core-free-icons"

import { Button } from "@deqah/ui"
import { formatDatePattern } from "@/lib/date"
import type { KnowledgeBaseFile } from "@/lib/types/chatbot"

interface KbFileRowProps {
  file: KnowledgeBaseFile
  onProcess: (id: string) => void
  onDelete: (id: string) => void
  processingId: string | null
  deletingId: string | null
}

export function KbFileRow({
  file,
  onProcess,
  onDelete,
  processingId,
  deletingId,
}: KbFileRowProps) {
  return (
    <div className="flex items-center justify-between border-b py-3 last:border-b-0">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-foreground">
          {file.fileName}
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {file.status}
          {file.updatedAt &&
            ` — ${formatDatePattern(file.updatedAt, "MMM d, yyyy")}`}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {file.status !== "completed" && file.status !== "processing" && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onProcess(file.id)}
            disabled={processingId === file.id}
          >
            {processingId === file.id ? "Processing..." : "Process"}
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onDelete(file.id)}
          disabled={deletingId === file.id}
          aria-label="Delete file"
        >
          <HugeiconsIcon icon={Delete02Icon} size={14} />
        </Button>
      </div>
    </div>
  )
}
