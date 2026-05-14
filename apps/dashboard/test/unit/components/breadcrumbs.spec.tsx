import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({
    locale: "ar",
    dir: "rtl" as const,
    t: (k: string) => {
      const map: Record<string, string> = {
        "nav.dashboard": "الرئيسية",
        "nav.clients": "المرضى",
        "nav.bookings": "الحجوزات",
        "nav.create": "إنشاء",
        "nav.edit": "تعديل",
      }
      return map[k] ?? k
    },
    toggleLocale: vi.fn(),
  }),
}))

vi.mock("next/navigation", () => ({
  usePathname: () => "/clients",
}))

import { Breadcrumbs } from "@/components/features/breadcrumbs"

describe("Breadcrumbs", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("renders with custom items", () => {
    render(
      <Breadcrumbs
        items={[
          { label: "الرئيسية", href: "/" },
          { label: "المرضى" },
        ]}
      />,
    )
    expect(screen.getByText("الرئيسية")).toBeInTheDocument()
    expect(screen.getByText("المرضى")).toBeInTheDocument()
  })

  it("returns null when only one item", () => {
    const { container } = render(
      <Breadcrumbs items={[{ label: "واحد" }]} />,
    )
    expect(container.innerHTML).toBe("")
  })

  it("auto-generates breadcrumbs from pathname", () => {
    render(<Breadcrumbs />)
    expect(screen.getByText("الرئيسية")).toBeInTheDocument()
    expect(screen.getByText("المرضى")).toBeInTheDocument()
  })

  it("renders nav element with aria-label", () => {
    render(
      <Breadcrumbs
        items={[
          { label: "أ", href: "/" },
          { label: "ب", href: "/b" },
        ]}
      />,
    )
    expect(screen.getByRole("navigation", { name: "Breadcrumbs" })).toBeInTheDocument()
  })

  it("renders last item as non-link text", () => {
    render(
      <Breadcrumbs
        items={[
          { label: "الرئيسية", href: "/" },
          { label: "المرضى" },
        ]}
      />,
    )
    const lastItem = screen.getByText("المرضى")
    expect(lastItem.tagName).toBe("SPAN")
  })
})
