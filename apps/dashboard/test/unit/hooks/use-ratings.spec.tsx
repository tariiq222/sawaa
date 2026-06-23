/**
 * useRatings — TanStack Query hook unit tests.
 *
 * Contract under test:
 *   - useRatings({page,perPage}) → fetch via fetchAllRatings, expose
 *     { ratings, meta, isLoading, error, refetch }. The page/perPage args
 *     must be forwarded to the api and into the query key so a paginated
 *     refetch is not confused with another page.
 *   - Error normalization: when the api throws an ApiError, surface its
 *     message; otherwise surface the generic Error.message. The hook must
 *     not let the raw error object escape unwrapped.
 *   - useRatingMutations → exposes updateVisibility({id, isPublic}) which
 *     calls updateRatingVisibility(id, isPublic) and invalidates the
 *     queryKeys.ratings.all subtree on success.
 */

import { renderHook, waitFor, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

const { fetchAllRatings, updateRatingVisibility } = vi.hoisted(() => ({
  fetchAllRatings: vi.fn(),
  updateRatingVisibility: vi.fn(),
}))

vi.mock("@/lib/api/employees", () => ({
  fetchAllRatings,
  updateRatingVisibility,
}))

import { ApiError } from "@/lib/api"
import { useRatings, useRatingMutations } from "@/hooks/use-ratings"

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function TestWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  TestWrapper.displayName = "TestWrapper"
  return TestWrapper
}

const SAMPLE_RATING = {
  id: "r-1",
  bookingId: "b-1",
  clientId: "c-1",
  employeeId: "e-1",
  score: 5,
  comment: "ممتاز",
  isPublic: true,
  createdAt: "2026-06-01T00:00:00.000Z",
}

describe("useRatings", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetches ratings with the provided pagination", async () => {
    fetchAllRatings.mockResolvedValueOnce({
      items: [SAMPLE_RATING],
      meta: { total: 1, page: 1, perPage: 10, totalPages: 1, hasNextPage: false, hasPreviousPage: false },
    })

    const { result } = renderHook(
      () => useRatings({ page: 1, perPage: 10 }),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(fetchAllRatings).toHaveBeenCalledWith({ page: 1, perPage: 10 })
    expect(result.current.ratings).toEqual([SAMPLE_RATING])
    expect(result.current.meta?.total).toBe(1)
  })

  it("defaults to page=1, perPage=20 when no args provided", async () => {
    fetchAllRatings.mockResolvedValueOnce({
      items: [],
      meta: { total: 0, page: 1, perPage: 20, totalPages: 1, hasNextPage: false, hasPreviousPage: false },
    })

    const { result } = renderHook(() => useRatings(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(fetchAllRatings).toHaveBeenCalledWith({ page: 1, perPage: 20 })
    expect(result.current.ratings).toEqual([])
    expect(result.current.meta).not.toBeNull()
  })

  it("treats a missing response as empty (defensive empty arrays)", async () => {
    fetchAllRatings.mockResolvedValueOnce(undefined as unknown as {
      items: typeof SAMPLE_RATING[]
      meta: { total: number; page: number; perPage: number; totalPages: number; hasNextPage: boolean; hasPreviousPage: boolean }
    })

    const { result } = renderHook(() => useRatings(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.ratings).toEqual([])
    expect(result.current.meta).toBeNull()
  })

  it("normalizes ApiError.message to a string", async () => {
    // Use the ApiError class so the hook's instanceof check exercises the
    // dedicated branch. Constructor: (status, message, body, code).
    const apiError = new ApiError(403, "Forbidden", { code: "FORBIDDEN" }, "FORBIDDEN")
    fetchAllRatings.mockRejectedValueOnce(apiError)

    const { result } = renderHook(() => useRatings(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.error).not.toBeNull())
    expect(result.current.error).toBe("Forbidden")
  })

  it("falls back to error.message for non-ApiError errors", async () => {
    fetchAllRatings.mockRejectedValueOnce(new Error("Network down"))

    const { result } = renderHook(() => useRatings(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.error).not.toBeNull())
    expect(result.current.error).toBe("Network down")
  })
})

describe("useRatingMutations", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("updateVisibility passes id + isPublic to updateRatingVisibility", async () => {
    updateRatingVisibility.mockResolvedValueOnce(undefined)

    const { result } = renderHook(() => useRatingMutations(), { wrapper: makeWrapper() })

    act(() => {
      result.current.updateVisibility.mutate({ id: "r-1", isPublic: false })
    })

    await waitFor(() => expect(updateRatingVisibility).toHaveBeenCalledTimes(1))
    expect(updateRatingVisibility).toHaveBeenCalledWith("r-1", false)
  })

  it("updateVisibility invalidates the ratings query subtree on success", async () => {
    updateRatingVisibility.mockResolvedValueOnce(undefined)
    fetchAllRatings.mockResolvedValue({
      items: [SAMPLE_RATING],
      meta: { total: 1, page: 1, perPage: 20, totalPages: 1, hasNextPage: false, hasPreviousPage: false },
    })

    const { result } = renderHook(
      () => ({
        query: useRatings(),
        mutations: useRatingMutations(),
      }),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => expect(result.current.query.isLoading).toBe(false))
    expect(fetchAllRatings).toHaveBeenCalledTimes(1)

    act(() => {
      result.current.mutations.updateVisibility.mutate({ id: "r-1", isPublic: true })
    })

    await waitFor(() => expect(result.current.mutations.updateVisibility.isSuccess).toBe(true))
    // invalidateQueries → refetch on the existing cache entry.
    await waitFor(() => expect(fetchAllRatings).toHaveBeenCalledTimes(2))
  })

  it("propagates updateVisibility errors", async () => {
    updateRatingVisibility.mockRejectedValueOnce(new Error("Forbidden"))

    const { result } = renderHook(() => useRatingMutations(), { wrapper: makeWrapper() })

    act(() => {
      result.current.updateVisibility.mutate({ id: "r-1", isPublic: false })
    })

    await waitFor(() => expect(result.current.updateVisibility.isError).toBe(true))
    expect((result.current.updateVisibility.error as Error).message).toBe("Forbidden")
  })
})
