import type { EmailBlock } from "@/lib/types/email-template"

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    // NOTE: { and } are intentionally NOT escaped — Handlebars must pass through
}

export function renderBlocksToHtml(blocks: EmailBlock[]): string {
  if (blocks.length === 0) return ""

  const inner = blocks.map((block) => {
    switch (block.type) {
      case "heading": {
        const tag = `h${block.level}`
        const sizes: Record<number, string> = { 1: "24px", 2: "20px", 3: "16px" }
        return `<${tag} style="margin:0 0 12px;font-size:${sizes[block.level]};font-weight:600;color:#111827;">${escapeHtml(block.text)}</${tag}>`
      }
      case "paragraph":
        return `<p style="margin:0 0 12px;font-size:14px;color:#374151;line-height:1.6;">${escapeHtml(block.text)}</p>`
      case "button": {
        const bg = block.color ?? "#354FD8"
        return `<div style="margin:0 0 12px;text-align:center;"><a href="${escapeHtml(block.url)}" style="display:inline-block;padding:10px 24px;background:${escapeHtml(bg)};color:#fff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500;">${escapeHtml(block.text)}</a></div>`
      }
      case "divider":
        return `<hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;" />`
      case "image": {
        const w = block.width ? ` width="${block.width}"` : ""
        return `<div style="margin:0 0 12px;text-align:center;"><img src="${escapeHtml(block.src)}" alt="${escapeHtml(block.alt)}"${w} style="max-width:100%;height:auto;" /></div>`
      }
      case "spacer":
        return `<div style="height:${block.height}px;"></div>`
      default:
        return ""
    }
  }).join("\n")

  return `<div style="font-family:IBM Plex Sans Arabic,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;">\n${inner}\n</div>`
}
