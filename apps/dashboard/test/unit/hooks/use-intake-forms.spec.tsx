import { renderHook, waitFor, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

// Reactive URL-state mock for next/navigation — useIntakeForms reads search
// params and writes via router.replace; we simulate that here so the hook
// behaves end-to-end in jsdom.
const navState = vi.hoisted(() => ({
  params: new URLSearchParams(),
  listeners: new Set<() => void>(),
  notify() { this.listeners.forEach((l) => l()) },
  reset() { this.params = new URLSearchParams(); this.listeners.clear() },
}))

vi.mock("next/navigation", async () => {
  const { useState, useEffect } = await import("react")
  return {
    useRouter: () => ({
      replace: (url: string) => {
        const q = url.indexOf("?")
        navState.params = new URLSearchParams(q >= 0 ? url.slice(q + 1) : "")
        navState.notify()
      },
      push: vi.fn(),
      refresh: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      prefetch: vi.fn(),
    }),
    usePathname: () => "/intake-forms",
    useSearchParams: () => {
      const [, force] = useState(0)
      useEffect(() => {
        const fn = () => force((n) => n + 1)
        navState.listeners.add(fn)
        return () => { navState.listeners.delete(fn) }
      }, [])
      return navState.params
    },
  }
})

const {
  fetchIntakeForms,
  fetchIntakeForm,
  createIntakeForm,
  updateIntakeForm,
  deleteIntakeForm,
  setIntakeFields,
} = vi.hoisted(() => ({
  fetchIntakeForms: vi.fn(),
  fetchIntakeForm: vi.fn(),
  createIntakeForm: vi.fn(),
  updateIntakeForm: vi.fn(),
  deleteIntakeForm: vi.fn(),
  setIntakeFields: vi.fn(),
}))

vi.mock("@/lib/api/intake-forms", () => ({
  fetchIntakeForms,
  fetchIntakeForm,
  createIntakeForm,
  updateIntakeForm,
  deleteIntakeForm,
  setIntakeFields,
}))

import {
  useIntakeForms,
  useIntakeForm,
  useIntakeFormMutations,
} from "@/hooks/use-intake-forms"

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function TestWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  TestWrapper.displayName = "TestWrapper"
  return TestWrapper
}

describe("useIntakeForms", () => {
  beforeEach(() => { vi.clearAllMocks(); navState.reset() })

  it("fetches intake forms and returns items", async () => {
    const forms = [{ id: "f-1", title: "Pre-visit Form" }]
    fetchIntakeForms.mockResolvedValueOnce(forms)

    const { result } = renderHook(() => useIntakeForms(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(fetchIntakeForms).toHaveBeenCalledWith({})
    expect(result.current.forms).toEqual(forms)
  })

  it("returns loading state initially", () => {
    fetchIntakeForms.mockReturnValueOnce(new Promise(() => undefined))

    const { result } = renderHook(() => useIntakeForms(), { wrapper: makeWrapper() })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.forms).toEqual([])
  })

  it("returns empty array when api returns no items", async () => {
    fetchIntakeForms.mockResolvedValueOnce([])

    const { result } = renderHook(() => useIntakeForms(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.forms).toEqual([])
  })

  it("passes initial query to api", async () => {
    fetchIntakeForms.mockResolvedValueOnce([])

    const { result } = renderHook(
      () => useIntakeForms({ serviceId: "svc-1" }),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(fetchIntakeForms).toHaveBeenCalledWith({ serviceId: "svc-1" })
  })

  it("setQuery is now a deprecated no-op (state is URL-driven)", async () => {
    // Migration note: setQuery used to drive an internal useState. After the
    // URL-state refactor, the hook reads from useSearchParams and writes via
    // router.push. setQuery is kept for backwards compatibility but only logs.
    fetchIntakeForms.mockResolvedValue([])
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

    const { result } = renderHook(() => useIntakeForms(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    fetchIntakeForms.mockClear()
    act(() => { result.current.setQuery({ serviceId: "svc-2" }) })

    expect(warnSpy).toHaveBeenCalled()
    expect(fetchIntakeForms).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})

describe("useIntakeForm", () => {
  beforeEach(() => { vi.clearAllMocks(); navState.reset() })

  it("fetches a single intake form by id", async () => {
    const form = { id: "f-1", title: "Pre-visit Form", fields: [] }
    fetchIntakeForm.mockResolvedValueOnce(form)

    const { result } = renderHook(() => useIntakeForm("f-1"), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(fetchIntakeForm).toHaveBeenCalledWith("f-1")
    expect(result.current.data).toEqual(form)
  })

  it("does not fetch when formId is null", () => {
    renderHook(() => useIntakeForm(null), { wrapper: makeWrapper() })
    expect(fetchIntakeForm).not.toHaveBeenCalled()
  })
})

describe("useIntakeFormMutations", () => {
  beforeEach(() => { vi.clearAllMocks(); navState.reset() })

  it("create calls createIntakeForm", async () => {
    createIntakeForm.mockResolvedValueOnce({ id: "f-new" })

    const { result } = renderHook(() => useIntakeFormMutations(), { wrapper: makeWrapper() })

    act(() => {
      result.current.create({ title: "New Form", serviceId: "svc-1" } as Parameters<typeof createIntakeForm>[0])
    })

    await waitFor(() => expect(createIntakeForm).toHaveBeenCalled())
  })

  it("update calls updateIntakeForm with formId and payload", async () => {
    updateIntakeForm.mockResolvedValueOnce({ id: "f-1" })

    const { result } = renderHook(() => useIntakeFormMutations(), { wrapper: makeWrapper() })

    act(() => {
      result.current.update({ formId: "f-1", payload: { title: "Updated" } as Parameters<typeof updateIntakeForm>[1] })
    })

    await waitFor(() => expect(updateIntakeForm).toHaveBeenCalledWith("f-1", { title: "Updated" }))
  })

  it("delete calls deleteIntakeForm with formId", async () => {
    deleteIntakeForm.mockResolvedValueOnce(undefined)

    const { result } = renderHook(() => useIntakeFormMutations(), { wrapper: makeWrapper() })

    act(() => { result.current.delete("f-1") })

    await waitFor(() => expect(deleteIntakeForm).toHaveBeenCalledWith("f-1"))
  })

  it("setFields calls setIntakeFields with formId and payload", async () => {
    setIntakeFields.mockResolvedValueOnce({ id: "f-1", fields: [] })

    const { result } = renderHook(() => useIntakeFormMutations(), { wrapper: makeWrapper() })

    act(() => {
      result.current.setFields({ formId: "f-1", payload: { fields: [] } as Parameters<typeof setIntakeFields>[1] })
    })

    await waitFor(() => expect(setIntakeFields).toHaveBeenCalledWith("f-1", { fields: [] }))
  })

  it("exposes loading state for create mutation", async () => {
    createIntakeForm.mockReturnValueOnce(new Promise(() => undefined))

    const { result } = renderHook(() => useIntakeFormMutations(), { wrapper: makeWrapper() })

    act(() => {
      result.current.create({ title: "Loading" } as Parameters<typeof createIntakeForm>[0])
    })

    await waitFor(() => expect(result.current.createLoading).toBe(true))
  })
})
