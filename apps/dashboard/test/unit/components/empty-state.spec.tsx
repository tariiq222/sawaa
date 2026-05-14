import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { EmptyState } from "@/components/features/empty-state"

describe("EmptyState", () => {
  it("renders title", () => {
    render(<EmptyState title="لا توجد بيانات" />)
    expect(screen.getByText("لا توجد بيانات")).toBeInTheDocument()
  })

  it("renders description when provided", () => {
    render(<EmptyState title="فارغ" description="لم يتم العثور على نتائج" />)
    expect(screen.getByText("فارغ")).toBeInTheDocument()
    expect(screen.getByText("لم يتم العثور على نتائج")).toBeInTheDocument()
  })

  it("does not render description when omitted", () => {
    const { container } = render(<EmptyState title="فارغ" />)
    const desc = container.querySelector("p.text-muted-foreground")
    expect(desc).toBeNull()
  })

  it("renders action button and calls onClick", async () => {
    const onClick = vi.fn()
    render(
      <EmptyState
        title="فارغ"
        action={{ label: "إضافة جديد", onClick }}
      />,
    )

    const button = screen.getByRole("button", { name: "إضافة جديد" })
    expect(button).toBeInTheDocument()

    await userEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it("does not render action button when omitted", () => {
    render(<EmptyState title="فارغ" />)
    expect(screen.queryByRole("button")).toBeNull()
  })
})
