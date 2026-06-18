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
        date: "2026-06-01",
        startTime: "09:00",
      }),
    )
    expect(result.current.showService).toBe(false)
    expect(result.current.showType).toBe(false)
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
        date: "",
        startTime: "",
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
        date: "",
        startTime: "",
      }),
    )
    expect(result.current.showService).toBe(true)
    expect(result.current.showType).toBe(true)
    expect(result.current.showDatetime).toBe(false)
    expect(result.current.canSubmit).toBe(false)
  })

  it("shows datetime directly when type is set (no duration gate)", () => {
    const { result } = renderHook(() =>
      useProgressiveDisclosure({
        employeeId: "emp-1",
        serviceId: "svc-1",
        type: "in_person",
        date: "",
        startTime: "",
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
        date: "2026-06-01",
        startTime: "",
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
        date: "2026-06-01",
        startTime: "09:00",
      }),
    )
    expect(result.current.showPayAtClinic).toBe(true)
    expect(result.current.canSubmit).toBe(true)
  })

  it("canSubmit is false when startTime is missing", () => {
    const { result } = renderHook(() =>
      useProgressiveDisclosure({
        employeeId: "emp-1",
        serviceId: "svc-1",
        type: "in_person",
        date: "2026-06-01",
        startTime: "",
      }),
    )
    expect(result.current.canSubmit).toBe(false)
  })

  it("canSubmit is true when all required fields are filled", () => {
    const { result } = renderHook(() =>
      useProgressiveDisclosure({
        employeeId: "emp-1",
        serviceId: "svc-1",
        type: "in_person",
        date: "2026-03-17",
        startTime: "09:00",
      }),
    )
    expect(result.current.canSubmit).toBe(true)
  })

  it("when employee cleared — all downstream hidden", () => {
    const { result } = renderHook(() =>
      useProgressiveDisclosure({
        employeeId: "",
        serviceId: "s1",
        type: "in_person",
        date: "2026-03-17",
        startTime: "09:00",
      })
    )
    expect(result.current.showService).toBe(false)
    expect(result.current.showType).toBe(false)
    expect(result.current.showDatetime).toBe(false)
    expect(result.current.canSubmit).toBe(false)
  })
})
