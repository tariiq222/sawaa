import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { describe, expect, it, vi, beforeEach } from "vitest"
import type { ReactNode } from "react"

const { fetchContactMessages, updateContactMessageStatus } = vi.hoisted(() => ({
  fetchContactMessages: vi.fn(),
  updateContactMessageStatus: vi.fn(),
}))

vi.mock("@/lib/api/contact-messages", () => ({
  fetchContactMessages,
  updateContactMessageStatus,
}))

import {
  useContactMessages,
  useUpdateContactMessageStatus,
} from "@/hooks/use-contact-messages"

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
  Wrapper.displayName = "Wrapper"
  return { Wrapper, qc }
}

describe("useContactMessages", () => {
  beforeEach(() => {
    fetchContactMessages.mockReset()
    updateContactMessageStatus.mockReset()
  })

  it("fetches with the provided query", async () => {
    fetchContactMessages.mockResolvedValue({ items: [], meta: { total: 0 } })
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useContactMessages({ status: "NEW" }), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(fetchContactMessages).toHaveBeenCalledWith({ status: "NEW" })
  })

  it("defaults to an empty-object query when called with no args", async () => {
    fetchContactMessages.mockResolvedValue({ items: [], meta: { total: 0 } })
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useContactMessages(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(fetchContactMessages).toHaveBeenCalledWith({})
  })

  it("returns the fetched items", async () => {
    const items = [{ id: "msg-1", name: "Sara" }]
    fetchContactMessages.mockResolvedValue({ items, meta: { total: 1 } })
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useContactMessages(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.data?.items).toEqual(items)
  })
})

describe("useUpdateContactMessageStatus", () => {
  beforeEach(() => {
    fetchContactMessages.mockReset()
    updateContactMessageStatus.mockReset()
  })

  it("calls the API with id + status", async () => {
    updateContactMessageStatus.mockResolvedValue(undefined)
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useUpdateContactMessageStatus(), { wrapper: Wrapper })
    await result.current.mutateAsync({ id: "msg-1", status: "READ" })
    expect(updateContactMessageStatus).toHaveBeenCalledWith("msg-1", "READ")
  })

  it("invalidates the contactMessages.all cache key on success", async () => {
    updateContactMessageStatus.mockResolvedValue(undefined)
    const { Wrapper, qc } = makeWrapper()
    const spy = vi.spyOn(qc, "invalidateQueries")
    const { result } = renderHook(() => useUpdateContactMessageStatus(), { wrapper: Wrapper })
    await result.current.mutateAsync({ id: "msg-1", status: "ARCHIVED" })
    expect(spy).toHaveBeenCalledWith({ queryKey: ["contact-messages"] })
  })

  it("surfaces mutation errors to the caller", async () => {
    updateContactMessageStatus.mockRejectedValue(new Error("403 Forbidden"))
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useUpdateContactMessageStatus(), { wrapper: Wrapper })
    await expect(result.current.mutateAsync({ id: "msg-1", status: "REPLIED" })).rejects.toThrow("403 Forbidden")
  })
})
