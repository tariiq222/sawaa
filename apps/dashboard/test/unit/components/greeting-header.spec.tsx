import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({
    locale: "ar",
    dir: "rtl" as const,
    t: (k: string) => {
      const map: Record<string, string> = {
        "dashboard.goodMorning": "صباح الخير",
        "dashboard.goodAfternoon": "مساء الخير",
        "dashboard.goodEvening": "مساء النور",
        "dashboard.greeting.hello": "{greeting}، {name}",
        "dashboard.greeting.summary": "لديك {count} حجز اليوم",
        "header.search": "بحث",
        "actions.newBooking": "حجز جديد",
      }
      return map[k] ?? k
    },
    toggleLocale: vi.fn(),
  }),
}))

vi.mock("@hugeicons/react", () => ({
  HugeiconsIcon: () => <span data-testid="icon" />,
}))

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

vi.mock("@deqah/ui", () => ({
  Button: ({ children, asChild, ...props }: React.PropsWithChildren<{ asChild?: boolean; [k: string]: unknown }>) =>
    asChild ? <>{children}</> : <button {...props}>{children}</button>,
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}))

import { GreetingHeader } from "@/components/features/dashboard/greeting-header"

describe("GreetingHeader", () => {
  it("renders userName in heading", () => {
    render(<GreetingHeader userName="أحمد" dateLabel="الأحد" bookingsCount={5} />)
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("أحمد")
  })

  it("renders bookingsCount in subtitle", () => {
    render(<GreetingHeader userName="أحمد" dateLabel="الأحد" bookingsCount={7} />)
    expect(screen.getByText(/7/)).toBeInTheDocument()
  })

  it("renders 0 when bookingsCount is negative", () => {
    render(<GreetingHeader userName="أحمد" dateLabel="الأحد" bookingsCount={-1} />)
    expect(screen.getByText(/0/)).toBeInTheDocument()
  })

  it("renders dateLabel in subtitle", () => {
    render(<GreetingHeader userName="أحمد" dateLabel="الأحد، 11 مايو 2026" bookingsCount={0} />)
    expect(screen.getByText(/الأحد، 11 مايو 2026/)).toBeInTheDocument()
  })

  it("renders a greeting based on time", () => {
    render(<GreetingHeader userName="سارة" dateLabel="الأحد" bookingsCount={0} />)
    const heading = screen.getByRole("heading", { level: 1 })
    expect(heading.textContent).toMatch(/(صباح الخير|مساء الخير|مساء النور)/)
  })
})
