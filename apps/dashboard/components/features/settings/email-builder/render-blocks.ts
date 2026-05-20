import type { EmailBlock } from "@/lib/types/email-template"

const DEFAULT_BUTTON_COLOR = "#354FD8"
const SAFE_IMAGE_SRC_FALLBACK = "about:blank"
const SAFE_LINK_HREF_FALLBACK = "#"

function escapeHtml(value: unknown): string {
  // NOTE: { and } are intentionally NOT escaped — Handlebars must pass through.
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function safeUrl(
  value: unknown,
  allowedProtocols: readonly string[],
  fallback: string
): string {
  if (typeof value !== "string") return fallback
  try {
    const parsed = new URL(value.trim())
    return allowedProtocols.includes(parsed.protocol) ? parsed.href : fallback
  } catch {
    return fallback
  }
}

function safeHexColor(value: unknown): string {
  if (typeof value !== "string") return DEFAULT_BUTTON_COLOR
  const trimmed = value.trim()
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(trimmed)
    ? trimmed
    : DEFAULT_BUTTON_COLOR
}

function clampInteger(
  value: unknown,
  min: number,
  max: number,
  fallback: number
): number {
  const numeric = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.min(max, Math.max(min, Math.trunc(numeric)))
}

function optionalClampedInteger(
  value: unknown,
  min: number,
  max: number
): number | null {
  if (value === null || value === undefined || value === "") return null
  const numeric = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(numeric)) return null
  return Math.min(max, Math.max(min, Math.trunc(numeric)))
}

export function renderBlocksToHtml(blocks: EmailBlock[]): string {
  if (blocks.length === 0) return ""

  const inner = blocks
    .map((block) => {
      switch (block.type) {
        case "heading": {
          const level = clampInteger(block.level, 1, 3, 2)
          const tag = `h${level}`
          const sizes: Record<number, string> = {
            1: "24px",
            2: "20px",
            3: "16px",
          }
          return `<${tag} style="margin:0 0 12px;font-size:${sizes[level]};font-weight:600;color:#111827;">${escapeHtml(block.text)}</${tag}>`
        }
        case "paragraph":
          return `<p style="margin:0 0 12px;font-size:14px;color:#374151;line-height:1.6;">${escapeHtml(block.text)}</p>`
        case "button": {
          const bg = safeHexColor(block.color)
          const href = safeUrl(
            block.url,
            ["http:", "https:", "mailto:"],
            SAFE_LINK_HREF_FALLBACK
          )
          return `<div style="margin:0 0 12px;text-align:center;"><a href="${escapeHtml(href)}" style="display:inline-block;padding:10px 24px;background:${escapeHtml(bg)};color:#fff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500;">${escapeHtml(block.text)}</a></div>`
        }
        case "divider":
          return `<hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;" />`
        case "image": {
          const src = safeUrl(
            block.src,
            ["http:", "https:"],
            SAFE_IMAGE_SRC_FALLBACK
          )
          const width = optionalClampedInteger(block.width, 1, 560)
          const w = width ? ` width="${width}"` : ""
          return `<div style="margin:0 0 12px;text-align:center;"><img src="${escapeHtml(src)}" alt="${escapeHtml(block.alt)}"${w} style="max-width:100%;height:auto;" /></div>`
        }
        case "spacer":
          return `<div style="height:${clampInteger(block.height, 0, 120, 16)}px;"></div>`
        default:
          return ""
      }
    })
    .join("\n")

  return `<div style="font-family:IBM Plex Sans Arabic,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;">\n${inner}\n</div>`
}
