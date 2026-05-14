"use client"

import { useMemo } from "react"
import type { EmailBlock } from "@/lib/types/email-template"
import { renderBlocksToHtml } from "./render-blocks"

interface Props {
  blocks: EmailBlock[]
}

export function BlockPreview({ blocks }: Props) {
  const __html = useMemo(() => renderBlocksToHtml(blocks), [blocks])

  if (blocks.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-border p-4 h-full flex items-center justify-center text-xs text-muted-foreground">
        (empty)
      </div>
    )
  }

  return (
    <div
      dangerouslySetInnerHTML={{ __html }}
      className="bg-white rounded-lg border border-border p-4 overflow-auto h-full"
      dir="auto"
    />
  )
}
