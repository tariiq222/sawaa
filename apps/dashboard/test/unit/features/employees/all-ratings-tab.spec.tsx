import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({
    locale: "ar",
    t: (key: string) =>
      ({
        "ratings.noEmployees.title": "لا يوجد ممارسون لعرض تقييماتهم",
        "ratings.noEmployees.description":
          "أضف ممارساً أولاً حتى تظهر التقييمات والملاحظات هنا.",
      })[key] ?? key,
  }),
}))

vi.mock("@hugeicons/react", () => ({
  HugeiconsIcon: ({ className }: { className?: string }) => (
    <span data-testid="icon" className={className} />
  ),
}))

import { AllRatingsTab } from "@/components/features/employees/all-ratings-tab"

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }

  return Wrapper
}

describe("AllRatingsTab", () => {
  it("shows a clear empty state when there are no employees to select", () => {
    render(<AllRatingsTab employees={[]} />, { wrapper: makeWrapper() })

    expect(
      screen.getByText("لا يوجد ممارسون لعرض تقييماتهم"),
    ).toBeInTheDocument()
    expect(
      screen.getByText("أضف ممارساً أولاً حتى تظهر التقييمات والملاحظات هنا."),
    ).toBeInTheDocument()
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument()
  })
})
