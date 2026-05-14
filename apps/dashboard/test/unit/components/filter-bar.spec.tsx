import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { FilterBarProps } from "@/components/features/filter-bar"

vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({
    locale: "ar",
    dir: "rtl" as const,
    t: (k: string) => {
      const map: Record<string, string> = {
        "common.reset": "إعادة تعيين",
        "common.from": "من",
        "common.to": "إلى",
      }
      return map[k] ?? k
    },
    toggleLocale: vi.fn(),
  }),
}))

import { FilterBar } from "@/components/features/filter-bar"

describe("FilterBar", () => {
  const baseProps: FilterBarProps = {
    hasFilters: false,
    onReset: vi.fn(),
  }

  beforeEach(() => { vi.clearAllMocks() })

  it("renders search input", () => {
    render(
      <FilterBar
        {...baseProps}
        search={{ value: "أحمد", onChange: vi.fn(), placeholder: "ابحث..." }}
      />,
    )
    const input = screen.getByPlaceholderText("ابحث...")
    expect(input).toBeInTheDocument()
    expect(input).toHaveValue("أحمد")
  })

  it("calls search onChange when typing", async () => {
    const onChange = vi.fn()
    render(
      <FilterBar
        {...baseProps}
        search={{ value: "", onChange, placeholder: "ابحث..." }}
      />,
    )

    await userEvent.type(screen.getByPlaceholderText("ابحث..."), "سارة")
    expect(onChange).toHaveBeenCalled()
  })

  it("renders tabs and highlights active tab", () => {
    render(
      <FilterBar
        {...baseProps}
        tabs={{
          items: [
            { key: "all", label: "الكل" },
            { key: "today", label: "اليوم" },
          ],
          activeKey: "today",
          onTabChange: vi.fn(),
        }}
      />,
    )

    expect(screen.getByText("الكل")).toBeInTheDocument()
    expect(screen.getByText("اليوم")).toBeInTheDocument()
  })

  it("calls onTabChange when tab clicked", async () => {
    const onTabChange = vi.fn()
    render(
      <FilterBar
        {...baseProps}
        tabs={{
          items: [
            { key: "all", label: "الكل" },
            { key: "today", label: "اليوم" },
          ],
          activeKey: "all",
          onTabChange,
        }}
      />,
    )

    await userEvent.click(screen.getByText("اليوم"))
    expect(onTabChange).toHaveBeenCalledWith("today")
  })

  it("renders reset button when hasFilters is true", () => {
    const onReset = vi.fn()
    render(
      <FilterBar
        hasFilters={true}
        onReset={onReset}
        search={{ value: "test", onChange: vi.fn() }}
      />,
    )

    const resetBtn = screen.getByText("إعادة تعيين")
    expect(resetBtn).toBeInTheDocument()
  })

  it("does not render reset button when hasFilters is false", () => {
    render(
      <FilterBar
        {...baseProps}
        search={{ value: "test", onChange: vi.fn() }}
      />,
    )

    expect(screen.queryByText("إعادة تعيين")).toBeNull()
  })

  it("calls onReset when reset button clicked", async () => {
    const onReset = vi.fn()
    render(
      <FilterBar
        hasFilters={true}
        onReset={onReset}
        search={{ value: "test", onChange: vi.fn() }}
      />,
    )

    await userEvent.click(screen.getByText("إعادة تعيين"))
    expect(onReset).toHaveBeenCalledTimes(1)
  })

  it("renders trailing content", () => {
    render(
      <FilterBar
        {...baseProps}
        trailing={<span>محتوى إضافي</span>}
      />,
    )
    expect(screen.getByText("محتوى إضافي")).toBeInTheDocument()
  })

  it("renders result count", () => {
    render(
      <FilterBar
        {...baseProps}
        search={{ value: "", onChange: vi.fn() }}
        resultCount={<span>25 نتيجة</span>}
      />,
    )
    expect(screen.getByText("25 نتيجة")).toBeInTheDocument()
  })
})
