import { describe, expect, it } from "vitest"
import { queryKeys } from "@/lib/query-keys"

describe("queryKeys", () => {
  describe("bookings", () => {
    it("all starts with 'bookings'", () => {
      expect(queryKeys.bookings.all[0]).toBe("bookings")
    })

    it("list embeds filters in key", () => {
      const key = queryKeys.bookings.list({ status: "CONFIRMED" })
      expect(key).toEqual(["bookings", "list", { status: "CONFIRMED" }])
    })

    it("detail includes id", () => {
      expect(queryKeys.bookings.detail("b-1")).toEqual(["bookings", "detail", "b-1"])
    })

    it("stats returns stable key", () => {
      expect(queryKeys.bookings.stats()).toEqual(["bookings", "stats"])
    })
  })

  describe("clients", () => {
    it("detail includes id", () => {
      expect(queryKeys.clients.detail("p-1")).toEqual(["clients", "detail", "p-1"])
    })

    it("stats includes client id", () => {
      expect(queryKeys.clients.stats("p-1")).toEqual(["clients", "stats", "p-1"])
    })
  })

  describe("employees", () => {
    it("slots includes id and date", () => {
      expect(queryKeys.employees.slots("pr-1", "2026-04-01")).toEqual(
        ["employees", "slots", "pr-1", "2026-04-01"],
      )
    })

    it("serviceTypes includes both ids", () => {
      const key = queryKeys.employees.serviceTypes("pr-1", "svc-1")
      expect(key).toContain("pr-1")
      expect(key).toContain("svc-1")
      expect(key).toContain("service-types")
    })

    it("availability includes employee id", () => {
      expect(queryKeys.employees.availability("pr-1")).toEqual(
        ["employees", "availability", "pr-1"],
      )
    })
  })

  describe("services", () => {
    it("categories returns stable key", () => {
      expect(queryKeys.services.categories()).toEqual(["services", "categories", {}])
    })

    it("bookingTypes includes serviceId", () => {
      expect(queryKeys.services.bookingTypes("svc-1")).toContain("svc-1")
    })

    it("intakeForms includes serviceId", () => {
      expect(queryKeys.services.intakeForms("svc-1")).toContain("svc-1")
    })
  })

  describe("payments", () => {
    it("byBooking includes bookingId", () => {
      expect(queryKeys.payments.byBooking("bk-1")).toEqual(["payments", "booking", "bk-1"])
    })
  })

  describe("invoices", () => {
    it("html includes invoice id", () => {
      expect(queryKeys.invoices.html("inv-1")).toEqual(["invoices", "html", "inv-1"])
    })
  })

  describe("chatbot", () => {
    it("sessions.detail includes session id", () => {
      expect(queryKeys.chatbot.sessions.detail("sess-1")).toEqual(
        ["chatbot", "sessions", "detail", "sess-1"],
      )
    })

    it("analytics.questions includes limit", () => {
      expect(queryKeys.chatbot.analytics.questions(10)).toContain(10)
    })
  })

  describe("organization", () => {
    it("holidays includes year", () => {
      expect(queryKeys.organization.holidays("branch-1", 2026)).toContain(2026)
    })
  })

  describe("branches", () => {
    it("employees includes branch id", () => {
      expect(queryKeys.branches.employees("br-1")).toEqual(
        ["branches", "employees", "br-1"],
      )
    })
  })

  describe("emailTemplates", () => {
    it("detail includes slug", () => {
      expect(queryKeys.emailTemplates.detail("welcome")).toEqual(
        ["email-templates", "detail", "welcome"],
      )
    })
  })

  describe("branding", () => {
    it("config returns stable key", () => {
      expect(queryKeys.branding.config()).toEqual(["branding", "config"])
    })

    it("all returns base key", () => {
      expect(queryKeys.branding.all).toEqual(["branding"])
    })
  })

  describe("intakeForms", () => {
    it("responses includes bookingId", () => {
      expect(queryKeys.intakeForms.responses("bk-1")).toEqual(
        ["intake-forms", "responses", "bk-1"],
      )
    })
  })

})
