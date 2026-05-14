import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { SectionHeader } from "@/components/features/section-header"
import { Stethoscope02Icon } from "@hugeicons/core-free-icons"

describe("SectionHeader", () => {
  it("renders title", () => {
    render(<SectionHeader icon={Stethoscope02Icon} title="الأطباء" />)
    expect(screen.getByText("الأطباء")).toBeInTheDocument()
  })

  it("renders description when provided", () => {
    render(
      <SectionHeader icon={Stethoscope02Icon} title="الأطباء" description="قائمة الأطباء المسجلين" />,
    )
    expect(screen.getByText("قائمة الأطباء المسجلين")).toBeInTheDocument()
  })

  it("does not render description when omitted", () => {
    const { container } = render(<SectionHeader icon={Stethoscope02Icon} title="الأطباء" />)
    const desc = container.querySelector("p")
    expect(desc).toBeNull()
  })

  it("renders icon", () => {
    const { container } = render(<SectionHeader icon={Stethoscope02Icon} title="الأطباء" />)
    const svg = container.querySelector("svg")
    expect(svg).toBeInTheDocument()
  })
})
