"use client"

import { Button } from "@deqah/ui"
import {
  Heading01Icon,
  TextIcon,
  ComponentIcon,
  MinusSignIcon,
  Image01Icon,
  ArrowExpandIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import type { EmailBlock } from "@/lib/types/email-template"

type BlockType = EmailBlock["type"]

interface Props {
  onAdd: (type: BlockType) => void
  t: (k: string) => string
}

const BLOCK_BUTTONS: { type: BlockType; labelKey: string; icon: Parameters<typeof HugeiconsIcon>[0]["icon"] }[] = [
  { type: "heading", labelKey: "settings.emailTemplates.addHeading", icon: Heading01Icon },
  { type: "paragraph", labelKey: "settings.emailTemplates.addParagraph", icon: TextIcon },
  { type: "button", labelKey: "settings.emailTemplates.addButton", icon: ComponentIcon },
  { type: "divider", labelKey: "settings.emailTemplates.addDivider", icon: MinusSignIcon },
  { type: "image", labelKey: "settings.emailTemplates.addImage", icon: Image01Icon },
  { type: "spacer", labelKey: "settings.emailTemplates.addSpacer", icon: ArrowExpandIcon },
]

export function BlockToolbar({ onAdd, t }: Props) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {BLOCK_BUTTONS.map(({ type, labelKey, icon }) => (
        <Button
          key={type}
          variant="outline"
          size="sm"
          onClick={() => onAdd(type)}
          className="gap-1.5 h-7 text-xs"
        >
          <HugeiconsIcon icon={icon} size={13} />
          {t(labelKey)}
        </Button>
      ))}
    </div>
  )
}
