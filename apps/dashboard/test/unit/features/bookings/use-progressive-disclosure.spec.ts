import { renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { useProgressiveDisclosure } from "@/components/features/bookings/use-progressive-disclosure"

describe("useProgressiveDisclosure", () => {
  it("returns all visibility flags false when employeeId is empty", () => {
    const { result } = renderHook(() =>
      useProgressiveDisclosure({
        employeeId: "",
        serviceId: "svc-1",
        type: "in_person",
        durationOptionId: "d-1",
        date: "2026-06-01",
        startTime: "09:00",
        hasDurationOptions: true,
      }),
    )
    expect(result.current.showService).toBe(false)
    expect(result.current.showType).toBe(false)
    expect(result.current.showDuration).toBe(false)
    expect(result.current.showDatetime).toBe(false)
    expect(result.current.showTime).toBe(false)
    expect(result.current.showPayAtClinic).toBe(false)
    expect(result.current.canSubmit).toBe(false)
  })

  it("shows service when employeeId is set", () => {
    const { result } = renderHook(() =>
      useProgressiveDisclosure({
        employeeId: "emp-1",
        serviceId: "",
        type: "",
        durationOptionId: "",
        date: "",
        startTime: "",
        hasDurationOptions: false,
      }),
    )
    expect(result.current.showService).toBe(true)
    expect(result.current.showType).toBe(false)
    expect(result.current.canSubmit).toBe(false)
  })

  it("shows type when employeeId and serviceId are set", () => {
    const { result } = renderHook(() =>
      useProgressiveDisclosure({
        employeeId: "emp-1",
        serviceId: "svc-1",
        type: "",
        durationOptionId: "",
        date: "",
        startTime: "",
        hasDurationOptions: false,
      }),
    )
    expect(result.current.showService).toBe(true)
    expect(result.current.showType).toBe(true)
    expect(result.current.showDuration).toBe(false)
    expect(result.current.canSubmit).toBe(false)
  })

  it("shows duration step when type is set and hasDurationOptions is true", () => {
    const { result } = renderHook(() =>
      useProgressiveDisclosure({
        employeeId: "emp-1",
        serviceId: "svc-1",
        type: "in_person",
        durationOptionId: "",
        date: "",
        startTime: "",
        hasDurationOptions: true,
      }),
    )
    expect(result.current.showDuration).toBe(true)
    expect(result.current.showDatetime).toBe(false)
  })

  it("skips duration step when hasDurationOptions is false", () => {
    const { result } = renderHook(() =>
      useProgressiveDisclosure({
        employeeId: "emp-1",
        serviceId: "svc-1",
        type: "in_person",
        durationOptionId: "",
        date: "",
        startTime: "",
        hasDurationOptions: false,
      }),
    )
    expect(result.current.showDuration).toBe(false)
    expect(result.current.showDatetime).toBe(true)
  })

  it("shows datetime when type is set and durationOptionId is selected", () => {
    const { result } = renderHook(() =>
      useProgressiveDisclosure({
        employeeId: "emp-1",
        serviceId: "svc-1",
        type: "in_person",
        durationOptionId: "d-1",
        date: "",
        startTime: "",
        hasDurationOptions: true,
      }),
    )
    expect(result.current.showDatetime).toBe(true)
    expect(result.current.showTime).toBe(false)
  })

  it("shows time when date is set", () => {
    const { result } = renderHook(() =>
      useProgressiveDisclosure({
        employeeId: "emp-1",
        serviceId: "svc-1",
        type: "in_person",
        durationOptionId: "d-1",
        date: "2026-06-01",
        startTime: "",
        hasDurationOptions: true,
      }),
    )
    expect(result.current.showTime).toBe(true)
    expect(result.current.showPayAtClinic).toBe(false)
  })

  it("shows payAtClinic when startTime is set", () => {
    const { result } = renderHook(() =>
      useProgressiveDisclosure({
        employeeId: "emp-1",
        serviceId: "svc-1",
        type: "in_person",
        durationOptionId: "d-1",
        date: "2026-06-01",
        startTime: "09:00",
        hasDurationOptions: true,
      }),
    )
    expect(result.current.showPayAtClinic).toBe(true)
    expect(result.current.canSubmit).toBe(true)
  })

  it("canSubmit is true when all required fields are set with no duration options", () => {
    const { result } = renderHook(() =>
      useProgressiveDisclosure({
        employeeId: "emp-1",
        serviceId: "svc-1",
        type: "in_person",
        durationOptionId: "",
        date: "2026-06-01",
        startTime: "09:00",
        hasDurationOptions: false,
      }),
    )
    expect(result.current.canSubmit).toBe(true)
  })

  it("canSubmit is false when durationOptionId is missing even with all other fields", () => {
    const { result } = renderHook(() =>
      useProgressiveDisclosure({
        employeeId: "emp-1",
        serviceId: "svc-1",
        type: "in_person",
        durationOptionId: "",
        date: "2026-06-01",
        startTime: "09:00",
        hasDurationOptions: true,
      }),
    )
    expect(result.current.canSubmit).toBe(false)
  })
})
