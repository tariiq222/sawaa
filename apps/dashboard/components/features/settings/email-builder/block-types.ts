export type { EmailBlock } from "@/lib/types/email-template"

type BlockType = "heading" | "paragraph" | "button" | "divider" | "image" | "spacer"

import type { EmailBlock } from "@/lib/types/email-template"

export function createBlock(type: BlockType): EmailBlock {
  const id = crypto.randomUUID()
  switch (type) {
    case "heading":
      return { type, id, text: "", level: 2 }
    case "paragraph":
      return { type, id, text: "" }
    case "button":
      return { type, id, text: "Click here", url: "https://", color: "#354FD8" }
    case "divider":
      return { type, id }
    case "image":
      return { type, id, src: "", alt: "", width: 560 }
    case "spacer":
      return { type, id, height: 24 }
  }
}
