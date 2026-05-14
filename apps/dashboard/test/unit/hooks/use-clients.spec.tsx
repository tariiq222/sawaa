import { renderHook, waitFor, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

const {
  fetchClients,
  fetchClient,
  updateClient,
  createWalkInClient,
} = vi.hoisted(() => ({
  fetchClients: vi.fn(),
  fetchClient: vi.fn(),
  updateClient: vi.fn(),
  createWalkInClient: vi.fn(),
}))

vi.mock("@/lib/api/clients", () => ({
  fetchClients,
  fetchClient,
  updateClient,
  createWalkInClient,
}))

import {
  useClients,
  useClient,
  useClientMutations,
  useInvalidateClients,
} from "@/hooks/use-clients"

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function TestWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  TestWrapper.displayName = "TestWrapper"
  return TestWrapper
}

describe("useClients", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetches clients and returns items", async () => {
    const items = [{ id: "p-1", name: "Ahmed" }]
    fetchClients.mockResolvedValueOnce({ items, meta: { total: 1 } })

    const { result } = renderHook(() => useClients(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(fetchClients).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, perPage: 20 }),
    )
    expect(result.current.clients).toEqual(items)
    expect(result.current.meta).toEqual({ total: 1 })
  })

  it("returns loading state initially", () => {
    fetchClients.mockReturnValueOnce(new Promise(() => undefined))

    const { result } = renderHook(() => useClients(), { wrapper: makeWrapper() })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.clients).toEqual([])
  })

  it("returns empty clients when api returns no items", async () => {
    fetchClients.mockResolvedValueOnce({ items: [], meta: { total: 0 } })

    const { result } = renderHook(() => useClients(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.clients).toEqual([])
  })

  it("passes search filter to api and resets page", async () => {
    fetchClients.mockResolvedValue({ items: [], meta: { total: 0 } })

    const { result } = renderHook(() => useClients(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => { result.current.setSearch("sara") })

    await waitFor(() =>
      expect(fetchClients).toHaveBeenCalledWith(
        expect.objectContaining({ search: "sara", page: 1 }),
      ),
    )
    expect(result.current.page).toBe(1)
  })

  it("resetSearch clears search and resets page", async () => {
    fetchClients.mockResolvedValue({ items: [], meta: { total: 0 } })

    const { result } = renderHook(() => useClients(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => { result.current.setSearch("test") })
    await waitFor(() => expect(result.current.search).toBe("test"))

    act(() => { result.current.resetSearch() })
    await waitFor(() => expect(result.current.search).toBe(""))
    expect(result.current.page).toBe(1)
  })
})

describe("useClient", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetches a single client by id", async () => {
    const client = { id: "p-1", name: "Ahmed" }
    fetchClient.mockResolvedValueOnce(client)

    const { result } = renderHook(() => useClient("p-1"), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(fetchClient).toHaveBeenCalledWith("p-1")
    expect(result.current.data).toEqual(client)
  })

  it("does not fetch when id is null", () => {
    const { result } = renderHook(() => useClient(null), { wrapper: makeWrapper() })

    expect(fetchClient).not.toHaveBeenCalled()
    expect(result.current.fetchStatus).toBe("idle")
  })
})

describe("useClientMutations", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("createMut calls createWalkInClient", async () => {
    createWalkInClient.mockResolvedValueOnce({ id: "p-new" })
    fetchClients.mockResolvedValue({ items: [], meta: { total: 0 } })

    const { result } = renderHook(() => useClientMutations(), { wrapper: makeWrapper() })

    act(() => {
      result.current.createMut.mutate({ name: "Walk-in" } as Parameters<typeof createWalkInClient>[0])
    })

    await waitFor(() => expect(createWalkInClient).toHaveBeenCalled())
  })

  it("updateMut calls updateClient with id and payload", async () => {
    updateClient.mockResolvedValueOnce({ id: "p-1" })

    const { result } = renderHook(() => useClientMutations(), { wrapper: makeWrapper() })

    act(() => {
      result.current.updateMut.mutate({ id: "p-1", payload: { name: "Updated" } } as Parameters<typeof result.current.updateMut.mutate>[0])
    })

    await waitFor(() => expect(updateClient).toHaveBeenCalledWith("p-1", expect.objectContaining({ name: "Updated" })))
  })

})

describe("useInvalidateClients", () => {
  it("returns a callable invalidation function", () => {
    const { result } = renderHook(() => useInvalidateClients(), { wrapper: makeWrapper() })
    expect(typeof result.current).toBe("function")
  })
})
