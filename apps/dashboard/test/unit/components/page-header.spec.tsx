import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { PageHeader } from "@/components/features/page-header"

describe("PageHeader", () => {
  it("renders title", () => {
    render(<PageHeader title="المرضى" />)
    expect(screen.getByRole("heading", { level: 1, name: "المرضى" })).toBeInTheDocument()
  })

  it("renders description when provided", () => {
    render(<PageHeader title="المرضى" description="إدارة بيانات المرضى" />)
    expect(screen.getByText("إدارة بيانات المرضى")).toBeInTheDocument()
  })

  it("does not render description when omitted", () => {
    const { container } = render(<PageHeader title="المرضى" />)
    const desc = container.querySelector("p")
    expect(desc).toBeNull()
  })

  it("renders children (action buttons)", () => {
    render(
      <PageHeader title="المرضى">
        <button>إضافة مريض</button>
      </PageHeader>,
    )
    expect(screen.getByRole("button", { name: "إضافة مريض" })).toBeInTheDocument()
  })
})
