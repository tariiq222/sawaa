import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({ locale: "ar", dir: "rtl" as const, t: (k: string) => k, toggleLocale: vi.fn() }),
}))

import { ErrorBanner } from "@/components/features/error-banner"

describe("ErrorBanner", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("renders error message", () => {
    render(<ErrorBanner message="حدث خطأ في الشبكة" />)
    expect(screen.getByText("حدث خطأ في الشبكة")).toBeInTheDocument()
  })

  it("renders retry button when onRetry provided", () => {
    render(<ErrorBanner message="خطأ" onRetry={vi.fn()} />)
    expect(screen.getByRole("button")).toBeInTheDocument()
  })

  it("does not render retry button when onRetry omitted", () => {
    render(<ErrorBanner message="خطأ" />)
    expect(screen.queryByRole("button")).toBeNull()
  })

  it("calls onRetry when retry button clicked", async () => {
    const onRetry = vi.fn()
    render(<ErrorBanner message="خطأ" onRetry={onRetry} />)

    await userEvent.click(screen.getByRole("button"))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it("uses custom retryLabel", () => {
    render(<ErrorBanner message="خطأ" onRetry={vi.fn()} retryLabel="حاول مجدداً" />)
    expect(screen.getByRole("button", { name: "حاول مجدداً" })).toBeInTheDocument()
  })
})
