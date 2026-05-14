"use client"

import type { EmailBlock } from "@/lib/types/email-template"
import { createBlock } from "./block-types"
import { BlockToolbar } from "./block-toolbar"
import { BlockItem } from "./block-item"

interface Props {
  blocks: EmailBlock[]
  onChange: (blocks: EmailBlock[]) => void
  t: (k: string) => string
}

export function BlockList({ blocks, onChange, t }: Props) {
  const appendBlock = (type: EmailBlock["type"]) => {
    onChange([...blocks, createBlock(type)])
  }

  const updateBlock = (id: string, updated: EmailBlock) => {
    onChange(blocks.map((b) => (b.id === id ? updated : b)))
  }

  const moveBlock = (id: string, dir: "up" | "down") => {
    const idx = blocks.findIndex((b) => b.id === id)
    if (idx === -1) return
    const next = [...blocks]
    if (dir === "up" && idx > 0) {
      ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
    } else if (dir === "down" && idx < next.length - 1) {
      ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
    }
    onChange(next)
  }

  const deleteBlock = (id: string) => {
    onChange(blocks.filter((b) => b.id !== id))
  }

  return (
    <div className="space-y-3">
      <BlockToolbar onAdd={appendBlock} t={t} />

      {blocks.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">
          {t("settings.emailTemplates.block.empty")}
        </p>
      ) : (
        <div className="space-y-2">
          {blocks.map((block, index) => (
            <BlockItem
              key={block.id}
              block={block}
              index={index}
              total={blocks.length}
              onChange={(updated) => updateBlock(block.id, updated)}
              onMove={(dir) => moveBlock(block.id, dir)}
              onDelete={() => deleteBlock(block.id)}
              t={t}
            />
          ))}
        </div>
      )}
    </div>
  )
}
