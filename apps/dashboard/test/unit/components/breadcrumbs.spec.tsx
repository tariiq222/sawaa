import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const route = vi.hoisted(() => ({ pathname: "/clients" }))

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
        "nav.packages": "باقات الجلسات",
        "packages.family.title": "باقات بخيارات جلسات",
      }
      return map[k] ?? k
    },
    toggleLocale: vi.fn(),
  }),
}))

vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
}))

import { Breadcrumbs } from "@/components/features/breadcrumbs"

describe("Breadcrumbs", () => {
  beforeEach(() => { vi.clearAllMocks(); route.pathname = "/clients" })

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

  it("maps the conversations route to its navigation translation", () => {
    route.pathname = "/conversations"
    render(<Breadcrumbs />)
    expect(screen.getByText("nav.conversations")).toBeInTheDocument()
  })

  it("labels family breadcrumbs and points the grouping segment to packages", () => {
    route.pathname = "/packages/families/create"
    render(<Breadcrumbs />)
    expect(screen.getByText("باقات بخيارات جلسات")).toHaveAttribute("href", "/packages")
  })

  it("points a family id breadcrumb to its edit route", () => {
    route.pathname = "/packages/families/00000000-0000-4000-8000-000000000001/edit"
    render(<Breadcrumbs />)
    expect(screen.getByText("00000000…")).toHaveAttribute("href", "/packages/families/00000000-0000-4000-8000-000000000001/edit")
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
