import { describe, expect, it } from "vitest"

import { renderBlocksToHtml } from "@/components/features/settings/email-builder/render-blocks"

describe("email builder sanitizer", () => {
  it("removes javascript: and data: URLs from href/src while preserving https and mailto URLs", () => {
    const html = renderBlocksToHtml([
      {
        type: "button",
        id: "unsafe-link",
        text: "Unsafe link",
        url: "javascript:alert(1)",
      },
      {
        type: "image",
        id: "unsafe-image",
        src: "data:image/svg+xml,<svg onload=alert(1) />",
        alt: "Unsafe image",
      },
      {
        type: "button",
        id: "safe-https",
        text: "Book now",
        url: "https://sawaa.example/bookings",
      },
      {
        type: "button",
        id: "safe-mailto",
        text: "Email us",
        url: "mailto:support@sawaa.example",
      },
      {
        type: "image",
        id: "safe-image",
        src: "https://cdn.sawaa.example/logo.png",
        alt: "Sawaa logo",
      },
    ])

    expect(html).not.toMatch(/javascript:/i)
    expect(html).not.toMatch(/\s(?:href|src)="\s*data:/i)
    expect(html).toContain('href="https://sawaa.example/bookings"')
    expect(html).toContain('href="mailto:support@sawaa.example"')
    expect(html).toContain('src="https://cdn.sawaa.example/logo.png"')
  })
})
