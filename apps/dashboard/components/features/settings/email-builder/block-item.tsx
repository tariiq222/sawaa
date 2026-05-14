"use client"

import { Button, Input, Label, Textarea } from "@deqah/ui"
import {
  ArrowUp01Icon,
  ArrowDown01Icon,
  Delete02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import type { EmailBlock } from "@/lib/types/email-template"

interface Props {
  block: EmailBlock
  index: number
  total: number
  onChange: (updated: EmailBlock) => void
  onMove: (dir: "up" | "down") => void
  onDelete: () => void
  t: (k: string) => string
}

function blockLabel(block: EmailBlock, t: (k: string) => string): string {
  const map: Record<string, string> = {
    heading: t("settings.emailTemplates.block.heading"),
    paragraph: t("settings.emailTemplates.block.paragraph"),
    button: t("settings.emailTemplates.block.button"),
    divider: t("settings.emailTemplates.block.divider"),
    image: t("settings.emailTemplates.block.image"),
    spacer: t("settings.emailTemplates.block.spacer"),
  }
  return map[block.type] ?? block.type
}

export function BlockItem({ block, index, total, onChange, onMove, onDelete, t }: Props) {
  return (
    <div className="border border-border rounded-lg p-3 bg-surface">
      {/* Header row */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {blockLabel(block, t)}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="size-7 p-0"
            onClick={() => onMove("up")}
            disabled={index === 0}
            title={t("settings.emailTemplates.move.up")}
          >
            <HugeiconsIcon icon={ArrowUp01Icon} size={14} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="size-7 p-0"
            onClick={() => onMove("down")}
            disabled={index === total - 1}
            title={t("settings.emailTemplates.move.down")}
          >
            <HugeiconsIcon icon={ArrowDown01Icon} size={14} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="size-7 p-0 text-destructive hover:text-destructive"
            onClick={onDelete}
            title={t("settings.emailTemplates.delete")}
          >
            <HugeiconsIcon icon={Delete02Icon} size={14} />
          </Button>
        </div>
      </div>

      {/* Block-specific editors */}
      {block.type === "heading" && (
        <div className="space-y-2">
          <div className="space-y-1">
            <Label className="text-xs">{t("settings.emailTemplates.field.text")}</Label>
            <Input
              value={block.text}
              onChange={(e) => onChange({ ...block, text: e.target.value })}
              dir="auto"
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t("settings.emailTemplates.field.level")}</Label>
            <select
              value={block.level}
              onChange={(e) => onChange({ ...block, level: Number(e.target.value) as 1 | 2 | 3 })}
              className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value={1}>H1</option>
              <option value={2}>H2</option>
              <option value={3}>H3</option>
            </select>
          </div>
        </div>
      )}

      {block.type === "paragraph" && (
        <div className="space-y-1">
          <Label className="text-xs">{t("settings.emailTemplates.field.text")}</Label>
          <Textarea
            value={block.text}
            onChange={(e) => onChange({ ...block, text: e.target.value })}
            dir="auto"
            rows={3}
            className="text-sm resize-y"
          />
        </div>
      )}

      {block.type === "button" && (
        <div className="space-y-2">
          <div className="space-y-1">
            <Label className="text-xs">{t("settings.emailTemplates.field.text")}</Label>
            <Input
              value={block.text}
              onChange={(e) => onChange({ ...block, text: e.target.value })}
              dir="auto"
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t("settings.emailTemplates.field.url")}</Label>
            <Input
              value={block.url}
              onChange={(e) => onChange({ ...block, url: e.target.value })}
              dir="ltr"
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t("settings.emailTemplates.field.color")}</Label>
            <Input
              value={block.color ?? "#354FD8"}
              onChange={(e) => onChange({ ...block, color: e.target.value })}
              dir="ltr"
              placeholder="#354FD8"
              className="h-8 text-sm"
            />
          </div>
        </div>
      )}

      {block.type === "divider" && (
        <p className="text-xs text-muted-foreground italic">
          {t("settings.emailTemplates.block.divider")} —
        </p>
      )}

      {block.type === "image" && (
        <div className="space-y-2">
          <div className="space-y-1">
            <Label className="text-xs">{t("settings.emailTemplates.field.src")}</Label>
            <Input
              value={block.src}
              onChange={(e) => onChange({ ...block, src: e.target.value })}
              dir="ltr"
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t("settings.emailTemplates.field.alt")}</Label>
            <Input
              value={block.alt}
              onChange={(e) => onChange({ ...block, alt: e.target.value })}
              dir="auto"
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t("settings.emailTemplates.field.width")}</Label>
            <Input
              type="number"
              value={block.width ?? ""}
              onChange={(e) => onChange({ ...block, width: e.target.value ? Number(e.target.value) : undefined })}
              dir="ltr"
              className="h-8 text-sm"
            />
          </div>
        </div>
      )}

      {block.type === "spacer" && (
        <div className="space-y-1">
          <Label className="text-xs">{t("settings.emailTemplates.field.height")}</Label>
          <Input
            type="number"
            value={block.height}
            onChange={(e) => onChange({ ...block, height: Number(e.target.value) })}
            dir="ltr"
            className="h-8 text-sm"
          />
        </div>
      )}
    </div>
  )
}
