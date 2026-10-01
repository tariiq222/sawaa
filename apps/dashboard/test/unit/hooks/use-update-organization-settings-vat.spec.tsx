import { renderHook, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

vi.mock("@/lib/api/organization-settings", () => ({
  fetchOrganizationSettings: vi.fn(),
  updateOrganizationSettings: vi.fn().mockResolvedValue({}),
}))

import { useUpdateOrganizationSettings } from "@/hooks/use-organization-settings"

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const invalidate = vi.spyOn(queryClient, "invalidateQueries")
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  const { result } = renderHook(() => useUpdateOrganizationSettings(), { wrapper })
  return { result, invalidate }
}

const keysOf = (invalidate: { mock: { calls: unknown[][] } }) =>
  invalidate.mock.calls.map((call) => JSON.stringify((call[0] as { queryKey: unknown }).queryKey))

describe("useUpdateOrganizationSettings — VAT rate", () => {
  it("refreshes package prices when the VAT rate changes", async () => {
    const { result, invalidate } = setup()
    await act(async () => { await result.current.mutateAsync({ vatRate: 0.15 }) })
    expect(keysOf(invalidate)).toEqual(expect.arrayContaining(['["packages"]', '["package-families"]']))
  })

  it("leaves package caches alone for other settings", async () => {
    const { result, invalidate } = setup()
    await act(async () => { await result.current.mutateAsync({ contactEmail: "a@b.sa" }) })
    expect(keysOf(invalidate)).not.toContain('["packages"]')
  })
})
