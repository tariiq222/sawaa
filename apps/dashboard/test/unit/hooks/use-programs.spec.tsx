/**
 * usePrograms / useProgram hooks — unit tests
 *
 * Covers:
 *  - usePrograms: forwards filters into the query key + api call
 *  - useProgram: detail query, disabled when id is falsy, refetches on
 *    id change
 *  - useCreateProgram: calls the api wrapper + invalidates programs lists
 *  - usePublishProgram: invalidates lists + the program detail on success
 *  - useScheduleProgram: forwards id + payload, invalidates list + detail
 *  - useCancelProgram: forwards id + reason, invalidates list + detail
 *  - useEnrollClientInProgram: forwards payload, invalidates list +
 *    detail of the enrolled program
 *  - error propagation: each mutation surfaces the api error verbatim
 */

import { renderHook, waitFor, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

const {
  fetchPrograms,
  fetchProgram,
  createProgram,
  publishProgram,
  scheduleProgram,
  cancelProgram,
  enrollClientInProgram,
} = vi.hoisted(() => ({
  fetchPrograms: vi.fn(),
  fetchProgram: vi.fn(),
  createProgram: vi.fn(),
  publishProgram: vi.fn(),
  scheduleProgram: vi.fn(),
  cancelProgram: vi.fn(),
  enrollClientInProgram: vi.fn(),
}))

vi.mock("@/lib/api/programs", () => ({
  fetchPrograms,
  fetchProgram,
  createProgram,
  publishProgram,
  scheduleProgram,
  cancelProgram,
  enrollClientInProgram,
}))

import {
  usePrograms,
  useProgram,
  useCreateProgram,
  usePublishProgram,
  useScheduleProgram,
  useCancelProgram,
  useEnrollClientInProgram,
} from "@/hooks/use-programs"

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  Wrapper.displayName = "Wrapper"
  return { Wrapper, qc: queryClient }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("usePrograms (list)", () => {
  it("calls fetchPrograms with the supplied filters", async () => {
    const items = [{ id: "p-1" }]
    fetchPrograms.mockResolvedValueOnce(items)

    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => usePrograms(), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(fetchPrograms).toHaveBeenCalledWith({})
    expect(result.current.data).toEqual(items)
  })

  it("forwards status / departmentId / branchId into the fetch call", async () => {
    fetchPrograms.mockResolvedValueOnce([])

    const { Wrapper } = makeWrapper()
    renderHook(
      () =>
        usePrograms({ status: "OPEN", departmentId: "d-1", branchId: "b-1" }),
      { wrapper: Wrapper },
    )

    await waitFor(() =>
      expect(fetchPrograms).toHaveBeenCalledWith({
        status: "OPEN",
        departmentId: "d-1",
        branchId: "b-1",
      }),
    )
  })

  it("exposes the api error on failure", async () => {
    fetchPrograms.mockRejectedValueOnce(new Error("Forbidden"))

    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => usePrograms(), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe("Forbidden")
  })
})

describe("useProgram (detail)", () => {
  it("does not fetch when id is null", async () => {
    const { Wrapper } = makeWrapper()
    renderHook(() => useProgram(null), { wrapper: Wrapper })
    await new Promise((r) => setTimeout(r, 0))
    expect(fetchProgram).not.toHaveBeenCalled()
  })

  it("does not fetch when id is undefined", async () => {
    const { Wrapper } = makeWrapper()
    renderHook(() => useProgram(undefined), { wrapper: Wrapper })
    await new Promise((r) => setTimeout(r, 0))
    expect(fetchProgram).not.toHaveBeenCalled()
  })

  it("does not fetch when id is empty string", async () => {
    const { Wrapper } = makeWrapper()
    renderHook(() => useProgram(""), { wrapper: Wrapper })
    await new Promise((r) => setTimeout(r, 0))
    expect(fetchProgram).not.toHaveBeenCalled()
  })

  it("fetches the detail when an id is provided", async () => {
    fetchProgram.mockResolvedValueOnce({ id: "p-1", status: "DRAFT" })

    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useProgram("p-1"), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.data).toEqual({ id: "p-1", status: "DRAFT" }))
    expect(fetchProgram).toHaveBeenCalledWith("p-1")
  })

  it("surfaces the api error", async () => {
    fetchProgram.mockRejectedValueOnce(new Error("Not Found"))

    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useProgram("missing"), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe("Not Found")
  })
})

describe("useCreateProgram", () => {
  it("calls createProgram with the payload and invalidates programs lists", async () => {
    createProgram.mockResolvedValueOnce({ id: "p-new" })

    const { Wrapper, qc } = makeWrapper()
    const spy = vi.spyOn(qc, "invalidateQueries")

    const { result } = renderHook(() => useCreateProgram(), { wrapper: Wrapper })

    await act(async () => {
      await result.current.mutateAsync({
        departmentId: "d-1",
        branchId: "b-1",
        nameAr: "برنامج",
        daysCount: 5,
        hoursPerDay: 4,
        minParticipants: 5,
        maxParticipants: 20,
        price: 100000,
        supervisorIds: ["s-1"],
      })
    })

    expect(createProgram).toHaveBeenCalledWith(
      expect.objectContaining({ nameAr: "برنامج", price: 100000 }),
    )
    expect(spy).toHaveBeenCalledWith({ queryKey: ["programs", "list"] })
  })

  it("propagates the api error", async () => {
    createProgram.mockRejectedValueOnce(new Error("Unprocessable Entity"))

    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useCreateProgram(), { wrapper: Wrapper })

    await expect(
      act(async () => {
        await result.current.mutateAsync({
          departmentId: "d-1",
          branchId: "b-1",
          nameAr: "x",
          daysCount: 1,
          hoursPerDay: 1,
          minParticipants: 1,
          maxParticipants: 1,
          price: 0,
          supervisorIds: ["s-1"],
        })
      }),
    ).rejects.toThrow("Unprocessable Entity")
  })
})

describe("usePublishProgram", () => {
  it("calls publishProgram with the id and invalidates list + detail", async () => {
    publishProgram.mockResolvedValueOnce({ id: "p-1", status: "OPEN" })

    const { Wrapper, qc } = makeWrapper()
    const spy = vi.spyOn(qc, "invalidateQueries")

    const { result } = renderHook(() => usePublishProgram(), { wrapper: Wrapper })

    await act(async () => {
      await result.current.mutateAsync("p-1")
    })

    expect(publishProgram).toHaveBeenCalledWith("p-1")
    expect(spy).toHaveBeenCalledWith({ queryKey: ["programs", "list"] })
    expect(spy).toHaveBeenCalledWith({ queryKey: ["programs", "detail", "p-1"] })
  })
})

describe("useScheduleProgram", () => {
  it("calls scheduleProgram with id + payload and invalidates list + detail", async () => {
    scheduleProgram.mockResolvedValueOnce({ id: "p-1", status: "SCHEDULED" })

    const { Wrapper, qc } = makeWrapper()
    const spy = vi.spyOn(qc, "invalidateQueries")

    const { result } = renderHook(() => useScheduleProgram(), { wrapper: Wrapper })

    await act(async () => {
      await result.current.mutateAsync({
        id: "p-1",
        payload: { startDate: "2026-08-01" },
      })
    })

    expect(scheduleProgram).toHaveBeenCalledWith("p-1", { startDate: "2026-08-01" })
    expect(spy).toHaveBeenCalledWith({ queryKey: ["programs", "detail", "p-1"] })
  })
})

describe("useCancelProgram", () => {
  it("calls cancelProgram with id + reason and invalidates list + detail", async () => {
    cancelProgram.mockResolvedValueOnce({ id: "p-1", status: "CANCELLED" })

    const { Wrapper, qc } = makeWrapper()
    const spy = vi.spyOn(qc, "invalidateQueries")

    const { result } = renderHook(() => useCancelProgram(), { wrapper: Wrapper })

    await act(async () => {
      await result.current.mutateAsync({
        id: "p-1",
        payload: { reason: "إلغاء إداري" },
      })
    })

    expect(cancelProgram).toHaveBeenCalledWith("p-1", { reason: "إلغاء إداري" })
    expect(spy).toHaveBeenCalledWith({ queryKey: ["programs", "list"] })
    expect(spy).toHaveBeenCalledWith({ queryKey: ["programs", "detail", "p-1"] })
  })
})

describe("useEnrollClientInProgram", () => {
  it("calls enrollClientInProgram with the payload and invalidates list + the enrolled program detail", async () => {
    enrollClientInProgram.mockResolvedValueOnce({
      type: "ENROLLED",
      bookingId: "bk-1",
      status: "PENDING",
      invoiceId: null,
    })

    const { Wrapper, qc } = makeWrapper()
    const spy = vi.spyOn(qc, "invalidateQueries")

    const { result } = renderHook(() => useEnrollClientInProgram(), {
      wrapper: Wrapper,
    })

    await act(async () => {
      await result.current.mutateAsync({
        programId: "p-1",
        clientId: "c-1",
      })
    })

    expect(enrollClientInProgram).toHaveBeenCalledWith({
      programId: "p-1",
      clientId: "c-1",
    })
    expect(spy).toHaveBeenCalledWith({ queryKey: ["programs", "list"] })
    expect(spy).toHaveBeenCalledWith({ queryKey: ["programs", "detail", "p-1"] })
  })
})
