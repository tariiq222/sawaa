import { renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { useProgressiveDisclosure } from "@/components/features/bookings/use-progressive-disclosure"

const base = {
  employeeId: "",
  serviceId: "",
  type: "",
  date: "",
  startTime: "",
}

describe("useProgressiveDisclosure", () => {
  describe("initial state — nothing selected", () => {
    it("hides everything except employee", () => {
      const { result } = renderHook(() => useProgressiveDisclosure(base))
      expect(result.current.showService).toBe(false)
      expect(result.current.showType).toBe(false)
      expect(result.current.showDatetime).toBe(false)
      expect(result.current.showTime).toBe(false)
      expect(result.current.showPayAtClinic).toBe(false)
      expect(result.current.canSubmit).toBe(false)
    })
  })

  describe("after employee selected", () => {
    it("shows service only", () => {
      const { result } = renderHook(() =>
        useProgressiveDisclosure({ ...base, employeeId: "p1" })
      )
      expect(result.current.showService).toBe(true)
      expect(result.current.showType).toBe(false)
      expect(result.current.showDatetime).toBe(false)
    })
  })

  describe("after employee + service selected", () => {
    it("shows type but not datetime until type selected", () => {
      const { result } = renderHook(() =>
        useProgressiveDisclosure({
          ...base,
          employeeId: "p1",
          serviceId: "s1",
        })
      )
      expect(result.current.showType).toBe(true)
      expect(result.current.showDatetime).toBe(false)
      expect(result.current.showTime).toBe(false)
    })
  })

  describe("after type selected", () => {
    it("shows datetime directly without duration gate", () => {
      const { result } = renderHook(() =>
        useProgressiveDisclosure({
          ...base,
          employeeId: "p1",
          serviceId: "s1",
          type: "in_person",
        })
      )
      expect(result.current.showDatetime).toBe(true)
      expect(result.current.showTime).toBe(false)
    })
  })

  describe("after date selected", () => {
    it("shows time slot", () => {
      const { result } = renderHook(() =>
        useProgressiveDisclosure({
          ...base,
          employeeId: "p1",
          serviceId: "s1",
          type: "in_person",
          date: "2026-03-17",
        })
      )
      expect(result.current.showTime).toBe(true)
      expect(result.current.showPayAtClinic).toBe(false)
    })
  })

  describe("after time selected", () => {
    it("shows payAtClinic", () => {
      const { result } = renderHook(() =>
        useProgressiveDisclosure({
          ...base,
          employeeId: "p1",
          serviceId: "s1",
          type: "in_person",
          date: "2026-03-17",
          startTime: "09:00",
        })
      )
      expect(result.current.showPayAtClinic).toBe(true)
    })
  })

  describe("canSubmit", () => {
    it("false when any required field missing", () => {
      const { result } = renderHook(() =>
        useProgressiveDisclosure({
          ...base,
          employeeId: "p1",
          serviceId: "s1",
          type: "in_person",
          date: "2026-03-17",
          // startTime missing
        })
      )
      expect(result.current.canSubmit).toBe(false)
    })

    it("true when all required fields filled", () => {
      const { result } = renderHook(() =>
        useProgressiveDisclosure({
          ...base,
          employeeId: "p1",
          serviceId: "s1",
          type: "in_person",
          date: "2026-03-17",
          startTime: "09:00",
        })
      )
      expect(result.current.canSubmit).toBe(true)
    })
  })

  describe("cascading reset simulation", () => {
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
})
