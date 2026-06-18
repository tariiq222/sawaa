import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

const { fetchAvailability, setAvailability } = vi.hoisted(() => ({
  fetchAvailability: vi.fn(),
  setAvailability: vi.fn(),
}))

vi.mock("@/lib/api/employees-schedule", () => ({
  fetchAvailability,
  setAvailability,
}))

import {
  useEmployeeSchedule,
  useUpdateEmployeeSchedule,
} from "@/hooks/use-employee-schedule"

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  function TestWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  TestWrapper.displayName = "TestWrapper"
  return { wrapper: TestWrapper, queryClient }
}

describe("useEmployeeSchedule", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fetches when employeeId is provided", async () => {
    vi.mocked(fetchAvailability).mockResolvedValue([])

    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useEmployeeSchedule("emp-1"), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(fetchAvailability).toHaveBeenCalledWith("emp-1")
  })

  it("does not fetch when employeeId is null", () => {
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useEmployeeSchedule(null), { wrapper })

    expect(result.current.isFetching).toBe(false)
    expect(fetchAvailability).not.toHaveBeenCalled()
  })
})

describe("useUpdateEmployeeSchedule", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("calls setAvailability with { schedule } and invalidates schedule + detail queries", async () => {
    vi.mocked(setAvailability).mockResolvedValue(undefined)

    const { wrapper, queryClient } = makeWrapper()
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries")

    const { result } = renderHook(() => useUpdateEmployeeSchedule("emp-1"), { wrapper })

    result.current.mutate([])

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(setAvailability).toHaveBeenCalledWith("emp-1", { schedule: [] })
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: expect.arrayContaining(["employees", "schedule", "emp-1"]),
      }),
    )
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: expect.arrayContaining(["employees", "detail", "emp-1"]),
      }),
    )
  })
})