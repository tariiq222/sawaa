import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("@hugeicons/react", () => ({
  HugeiconsIcon: () => <span data-testid="hugi-icon" />,
}))

import { DetailSection, DetailRow } from "@/components/features/detail-sheet-parts"

describe("DetailSection", () => {
  it("renders title and children", () => {
    render(
      <DetailSection title="معلومات">
        <div>child content</div>
      </DetailSection>,
    )
    expect(screen.getByText("معلومات")).toBeInTheDocument()
    expect(screen.getByText("child content")).toBeInTheDocument()
  })

  it("applies className", () => {
    const { container } = render(
      <DetailSection title="T" className="custom-class">
        <div />
      </DetailSection>,
    )
    expect(container.querySelector(".custom-class")).toBeInTheDocument()
  })
})

describe("DetailRow", () => {
  it("renders label and value", () => {
    render(<DetailRow label="الاسم" value="أحمد" />)
    expect(screen.getByText("الاسم:")).toBeInTheDocument()
    expect(screen.getByText("أحمد")).toBeInTheDocument()
  })

  it("renders icon when provided instead of label text", () => {
    const FakeIcon = () => <svg data-testid="icon" />
    render(<DetailRow label="L" value="V" icon={FakeIcon as never} />)
    expect(screen.getByTestId("hugi-icon")).toBeInTheDocument()
    expect(screen.queryByText("L:")).toBeNull()
  })

  it("renders label text when no icon", () => {
    render(<DetailRow label="القيمة" value="100" />)
    expect(screen.getByText("القيمة:")).toBeInTheDocument()
  })
})
