import React from "react"
import { renderHook, waitFor, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

const { addToWaitlist } = vi.hoisted(() => ({
  addToWaitlist: vi.fn(),
}))

vi.mock("@/lib/api/waitlist", () => ({
  addToWaitlist,
}))

import { useWaitlistMutations } from "@/hooks/use-waitlist"

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  function TestWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  TestWrapper.displayName = "TestWrapper"
  return TestWrapper
}

describe("useWaitlistMutations", () => {
  beforeEach(() => vi.clearAllMocks())

  it("addMut calls addToWaitlist", async () => {
    addToWaitlist.mockResolvedValueOnce(undefined)

    const { result } = renderHook(() => useWaitlistMutations(), {
      wrapper: makeWrapper(),
    })

    await act(async () => {
      await result.current.addMut.mutateAsync({} as Parameters<typeof addToWaitlist>[0])
    })

    expect(addToWaitlist).toHaveBeenCalled()
  })

  it("addMut is idle before being called", () => {
    const { result } = renderHook(() => useWaitlistMutations(), {
      wrapper: makeWrapper(),
    })
    expect(result.current.addMut.isPending).toBe(false)
  })

  it("invalidates waitlist queries after successful add", async () => {
    addToWaitlist.mockResolvedValueOnce(undefined)

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries")

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    const { result } = renderHook(() => useWaitlistMutations(), { wrapper })

    await act(async () => {
      await result.current.addMut.mutateAsync({} as Parameters<typeof addToWaitlist>[0])
    })

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ["waitlist"] }),
    )
  })
})
