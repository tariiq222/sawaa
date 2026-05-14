import { renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { UseFormReturn, FieldValues } from "react-hook-form"

import {
  useBookingCreateResets,
  useBookingEditDateReset,
} from "@/components/features/bookings/use-booking-form-resets"

function makeForm(): UseFormReturn<FieldValues> {
  return {
    watch: vi.fn(),
    setValue: vi.fn(),
  } as unknown as UseFormReturn<FieldValues>
}

describe("useBookingCreateResets", () => {
  beforeEach(() => vi.clearAllMocks())

  it("clears durationOptionId and startTime on initial mount", () => {
    const form = makeForm()
    renderHook(() =>
      useBookingCreateResets(form, "prac-1", "svc-1", "SINGLE", "2026-03-27"),
    )
    expect(form.setValue).toHaveBeenCalledWith("durationOptionId", "")
    expect(form.setValue).toHaveBeenCalledWith("startTime", "")
  })

  it("resets durationOptionId and startTime when serviceId changes", () => {
    const form = makeForm()
    const { rerender } = renderHook(
      ({ serviceId }: { serviceId: string }) =>
        useBookingCreateResets(form, "prac-1", serviceId, "SINGLE", "2026-03-27"),
      { initialProps: { serviceId: "svc-1" } },
    )

    vi.clearAllMocks()

    rerender({ serviceId: "svc-2" })

    expect(form.setValue).toHaveBeenCalledWith("durationOptionId", "")
    expect(form.setValue).toHaveBeenCalledWith("startTime", "")
  })

  it("resets startTime (only) when date changes", () => {
    const form = makeForm()
    const { rerender } = renderHook(
      ({ date }: { date: string }) =>
        useBookingCreateResets(form, "prac-1", "svc-1", "SINGLE", date),
      { initialProps: { date: "2026-03-27" } },
    )

    vi.clearAllMocks()

    rerender({ date: "2026-03-28" })

    // startTime reset fired from the date effect
    expect(form.setValue).toHaveBeenCalledWith("startTime", "")
    // durationOptionId NOT reset by the date effect alone
    const durationCalls = (form.setValue as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([field]) => field === "durationOptionId",
    )
    expect(durationCalls).toHaveLength(0)
  })
})

describe("useBookingEditDateReset", () => {
  beforeEach(() => vi.clearAllMocks())

  it("does not reset when originalDate is undefined", () => {
    const form = makeForm()
    renderHook(() =>
      useBookingEditDateReset(form, "2026-03-27", undefined),
    )
    expect(form.setValue).not.toHaveBeenCalled()
  })

  it("does not reset when date equals originalDate", () => {
    const form = makeForm()
    renderHook(() =>
      useBookingEditDateReset(form, "2026-03-27", "2026-03-27"),
    )
    expect(form.setValue).not.toHaveBeenCalled()
  })

  it("resets startTime when date differs from originalDate", () => {
    const form = makeForm()
    renderHook(() =>
      useBookingEditDateReset(form, "2026-03-28", "2026-03-27"),
    )
    expect(form.setValue).toHaveBeenCalledWith("startTime", "")
  })

  it("resets startTime when date changes after initial render", () => {
    const form = makeForm()
    const { rerender } = renderHook(
      ({ date }: { date: string }) =>
        useBookingEditDateReset(form, date, "2026-03-27"),
      { initialProps: { date: "2026-03-27" } },
    )

    vi.clearAllMocks()

    rerender({ date: "2026-03-29" })

    expect(form.setValue).toHaveBeenCalledWith("startTime", "")
  })
})
