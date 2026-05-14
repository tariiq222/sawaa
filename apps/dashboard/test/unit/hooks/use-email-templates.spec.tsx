import { renderHook, waitFor, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

const { fetchEmailTemplates, updateEmailTemplate, previewEmailTemplate } = vi.hoisted(() => ({
  fetchEmailTemplates: vi.fn(),
  updateEmailTemplate: vi.fn(),
  previewEmailTemplate: vi.fn(),
}))

vi.mock("@/lib/api/email-templates", () => ({
  fetchEmailTemplates,
  updateEmailTemplate,
  previewEmailTemplate,
}))

import { useEmailTemplates, useEmailTemplateMutations } from "@/hooks/use-email-templates"

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function TestWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  TestWrapper.displayName = "TestWrapper"
  return TestWrapper
}

describe("useEmailTemplates", () => {
  beforeEach(() => vi.clearAllMocks())

  it("fetches and returns email templates", async () => {
    const templates = [{ id: "t-1", slug: "welcome", subject: "Welcome" }]
    fetchEmailTemplates.mockResolvedValueOnce(templates)

    const { result } = renderHook(() => useEmailTemplates(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(fetchEmailTemplates).toHaveBeenCalled()
    expect(result.current.data).toEqual(templates)
  })

  it("returns undefined data while loading", () => {
    fetchEmailTemplates.mockReturnValueOnce(new Promise(() => undefined))
    const { result } = renderHook(() => useEmailTemplates(), { wrapper: makeWrapper() })
    expect(result.current.isLoading).toBe(true)
    expect(result.current.data).toBeUndefined()
  })
})

describe("useEmailTemplateMutations", () => {
  beforeEach(() => vi.clearAllMocks())

  it("updateMut calls updateEmailTemplate with id and payload", async () => {
    updateEmailTemplate.mockResolvedValueOnce({ id: "t-1", slug: "welcome" })
    fetchEmailTemplates.mockResolvedValue([])

    const { result } = renderHook(() => useEmailTemplateMutations(), { wrapper: makeWrapper() })

    act(() => {
      result.current.updateMut.mutate({
        id: "t-1",
        subject: "Updated Subject",
      } as Parameters<typeof result.current.updateMut.mutate>[0])
    })

    await waitFor(() => expect(updateEmailTemplate).toHaveBeenCalledWith(
      "t-1",
      expect.objectContaining({ subject: "Updated Subject" }),
    ))
  })

  it("updateMut invalidates templates query on success", async () => {
    updateEmailTemplate.mockResolvedValueOnce({ id: "t-1" })
    fetchEmailTemplates.mockResolvedValue([])

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries")

    const { result } = renderHook(() => useEmailTemplateMutations(), { wrapper })

    act(() => {
      result.current.updateMut.mutate({
        id: "t-1",
        subject: "X",
      } as Parameters<typeof result.current.updateMut.mutate>[0])
    })

    await waitFor(() => expect(invalidateSpy).toHaveBeenCalled())
  })

  it("previewMut calls previewEmailTemplate with id and payload", async () => {
    previewEmailTemplate.mockResolvedValueOnce({ subject: "Hi", body: "<p>preview</p>" })

    const { result } = renderHook(() => useEmailTemplateMutations(), { wrapper: makeWrapper() })

    act(() => {
      result.current.previewMut.mutate({
        id: "t-1",
        context: {},
      })
    })

    await waitFor(() => expect(previewEmailTemplate).toHaveBeenCalledWith(
      "t-1",
      expect.objectContaining({ context: {} }),
    ))
  })
})
