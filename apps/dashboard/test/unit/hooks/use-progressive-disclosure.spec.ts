import { renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { useProgressiveDisclosure } from "@/components/features/bookings/use-progressive-disclosure"

const base = {
  employeeId: "",
  serviceId: "",
  type: "",
  durationOptionId: "",
  date: "",
  startTime: "",
  hasDurationOptions: false,
}

describe("useProgressiveDisclosure", () => {
  describe("initial state — nothing selected", () => {
    it("hides everything except employee", () => {
      const { result } = renderHook(() => useProgressiveDisclosure(base))
      expect(result.current.showService).toBe(false)
      expect(result.current.showType).toBe(false)
      expect(result.current.showDuration).toBe(false)
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

  describe("after employee + service selected (no duration options)", () => {
    it("shows type and datetime", () => {
      const { result } = renderHook(() =>
        useProgressiveDisclosure({
          ...base,
          employeeId: "p1",
          serviceId: "s1",
          type: "in_person",
          hasDurationOptions: false,
        })
      )
      expect(result.current.showType).toBe(true)
      expect(result.current.showDuration).toBe(false)
      expect(result.current.showDatetime).toBe(true)
      expect(result.current.showTime).toBe(false)
    })
  })

  describe("when hasDurationOptions = true", () => {
    it("shows duration but NOT datetime until durationOptionId selected", () => {
      const { result } = renderHook(() =>
        useProgressiveDisclosure({
          ...base,
          employeeId: "p1",
          serviceId: "s1",
          type: "in_person",
          hasDurationOptions: true,
          durationOptionId: "",
        })
      )
      expect(result.current.showDuration).toBe(true)
      expect(result.current.showDatetime).toBe(false)
    })

    it("shows datetime after durationOptionId selected", () => {
      const { result } = renderHook(() =>
        useProgressiveDisclosure({
          ...base,
          employeeId: "p1",
          serviceId: "s1",
          type: "in_person",
          hasDurationOptions: true,
          durationOptionId: "d1",
        })
      )
      expect(result.current.showDuration).toBe(true)
      expect(result.current.showDatetime).toBe(true)
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

    it("true when all required fields filled (no duration options)", () => {
      const { result } = renderHook(() =>
        useProgressiveDisclosure({
          ...base,
          employeeId: "p1",
          serviceId: "s1",
          type: "in_person",
          date: "2026-03-17",
          startTime: "09:00",
          hasDurationOptions: false,
        })
      )
      expect(result.current.canSubmit).toBe(true)
    })

    it("false when duration required but not selected", () => {
      const { result } = renderHook(() =>
        useProgressiveDisclosure({
          ...base,
          employeeId: "p1",
          serviceId: "s1",
          type: "in_person",
          date: "2026-03-17",
          startTime: "09:00",
          hasDurationOptions: true,
          durationOptionId: "",
        })
      )
      expect(result.current.canSubmit).toBe(false)
    })

    it("true when duration required and selected", () => {
      const { result } = renderHook(() =>
        useProgressiveDisclosure({
          ...base,
          employeeId: "p1",
          serviceId: "s1",
          type: "in_person",
          date: "2026-03-17",
          startTime: "09:00",
          hasDurationOptions: true,
          durationOptionId: "d1",
        })
      )
      expect(result.current.canSubmit).toBe(true)
    })
  })

  describe("cascading reset simulation", () => {
    it("when employee cleared — all downstream hidden", () => {
      // Simulate user had everything filled then changed employee to ""
      const { result } = renderHook(() =>
        useProgressiveDisclosure({
          employeeId: "",
          serviceId: "s1",   // stale — would be cleared by useBookingCreateResets
          type: "in_person",
          date: "2026-03-17",
          startTime: "09:00",
          durationOptionId: "",
          hasDurationOptions: false,
        })
      )
      // Progressive disclosure only checks employeeId, so everything collapses
      expect(result.current.showService).toBe(false)
      expect(result.current.showType).toBe(false)
      expect(result.current.showDatetime).toBe(false)
      expect(result.current.canSubmit).toBe(false)
    })
  })
})
