import { renderHook } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { describe, expect, it, vi, beforeEach } from "vitest"
import type { ReactNode } from "react"

const { setClientActive, toastError, toastSuccess } = vi.hoisted(() => ({
  setClientActive: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}))

vi.mock("@/lib/api/clients", () => ({
  setClientActive,
}))

vi.mock("sonner", () => ({
  toast: { error: toastError, success: toastSuccess },
}))

import {
  useSetClientActive,
  useSetClientActiveWithToast,
} from "@/hooks/use-set-client-active"

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
  Wrapper.displayName = "Wrapper"
  return { Wrapper, qc }
}

describe("useSetClientActive", () => {
  beforeEach(() => {
    setClientActive.mockReset()
    toastError.mockReset()
    toastSuccess.mockReset()
  })

  it("calls setClientActive with clientId + payload", async () => {
    setClientActive.mockResolvedValue(undefined)
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useSetClientActive("c-1"), { wrapper: Wrapper })
    await result.current.mutateAsync({ isActive: true })
    expect(setClientActive).toHaveBeenCalledWith("c-1", { isActive: true })
  })

  it("invalidates client detail + list queries on success", async () => {
    setClientActive.mockResolvedValue(undefined)
    const { Wrapper, qc } = makeWrapper()
    const spy = vi.spyOn(qc, "invalidateQueries")
    const { result } = renderHook(() => useSetClientActive("c-1"), { wrapper: Wrapper })
    await result.current.mutateAsync({ isActive: false })
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ["clients", "detail", "c-1"] }))
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ["clients"] }))
  })

  it("toasts the fallback error message on failure", async () => {
    setClientActive.mockRejectedValue(new Error("Boom"))
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useSetClientActive("c-1"), { wrapper: Wrapper })
    await expect(result.current.mutateAsync({ isActive: true })).rejects.toBeTruthy()
    expect(toastError).toHaveBeenCalledWith("فشل تحديث حالة الحساب")
  })
})

describe("useSetClientActiveWithToast", () => {
  beforeEach(() => {
    setClientActive.mockReset()
    toastError.mockReset()
    toastSuccess.mockReset()
  })

  it("emits the success message from the caller-provided getter", async () => {
    setClientActive.mockResolvedValue(undefined)
    const getMsg = vi.fn((isActive: boolean) => (isActive ? "enabled!" : "disabled!"))
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(
      () => useSetClientActiveWithToast("c-1", getMsg),
      { wrapper: Wrapper },
    )
    await result.current.mutateAsync({ isActive: true })
    expect(getMsg).toHaveBeenCalledWith(true)
    expect(toastSuccess).toHaveBeenCalledWith("enabled!")
  })

  it("emits the disabled message when deactivating", async () => {
    setClientActive.mockResolvedValue(undefined)
    const getMsg = (isActive: boolean) => (isActive ? "on" : "off")
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(
      () => useSetClientActiveWithToast("c-1", getMsg),
      { wrapper: Wrapper },
    )
    await result.current.mutateAsync({ isActive: false })
    expect(toastSuccess).toHaveBeenCalledWith("off")
  })
})
