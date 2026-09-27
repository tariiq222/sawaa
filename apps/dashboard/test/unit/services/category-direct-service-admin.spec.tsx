import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { fetchServices, createService } = vi.hoisted(() => ({
  fetchServices: vi.fn(),
  createService: vi.fn(),
}))

vi.mock("@/lib/api/services", () => ({ fetchServices, createService }))
vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key, locale: "en" }),
}))
vi.mock("@/components/features/services/booking-types-editor", () => ({
  BookingTypesEditor: ({ serviceId }: { serviceId: string }) => <div data-testid="booking-editor">{serviceId}</div>,
}))

import { CategorySettingsTab } from "@/components/features/services/category-settings-tab"

function renderTab() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
  return render(<CategorySettingsTab categoryId="cat-1" mode="edit" bookingMode="DIRECT" />, { wrapper: Wrapper })
}

describe("CategorySettingsTab direct-service resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("selects the hidden direct row when a visible service comes first", async () => {
    fetchServices.mockResolvedValueOnce({ items: [
      { id: "visible", isHidden: false },
      { id: "hidden", isHidden: true },
    ] })

    renderTab()

    expect(await screen.findByTestId("booking-editor")).toHaveTextContent("hidden")
    expect(createService).not.toHaveBeenCalled()
  })

  it("shows a retryable repair state when the internal row is missing without creating one", async () => {
    fetchServices.mockResolvedValueOnce({ items: [{ id: "visible", isHidden: false }] })

    renderTab()

    expect(await screen.findByText("services.categories.settings.internalServiceMissing.title")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "services.categories.settings.internalServiceMissing.retry" })).toBeEnabled()
    expect(createService).not.toHaveBeenCalled()
    await waitFor(() => expect(fetchServices).toHaveBeenCalledTimes(1))
  })
})
