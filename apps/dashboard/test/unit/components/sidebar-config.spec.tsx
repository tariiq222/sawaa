import { describe, expect, it } from "vitest"

import {
  operationsNav,
  practiceNav,
  catalogNav,
  managementNav,
  communicationNav,
  systemNav,
  navGroups,
} from "@/components/sidebar-config"

describe("SidebarConfig — persona groups", () => {
  const allNavItems = [
    ...operationsNav,
    ...practiceNav,
    ...catalogNav,
    ...managementNav,
    ...communicationNav,
    ...systemNav,
  ]

  const allHrefs = allNavItems.map((item) => item.href)

  it("no duplicate hrefs across all nav items", () => {
    const duplicates = allHrefs.filter((href, i) => allHrefs.indexOf(href) !== i)
    expect(duplicates).toHaveLength(0)
  })

  it("navGroups has all 6 persona sections", () => {
    expect(navGroups).toHaveLength(6)
    expect(navGroups.map((g) => g.labelKey)).toEqual([
      "nav.operations",
      "nav.practice",
      "nav.catalog",
      "nav.management",
      "nav.communication",
      "nav.system",
    ])
  })

  it("operationsNav contains front-desk items", () => {
    expect(allHrefs).toContain("/bookings")
    expect(allHrefs).toContain("/programs")
    expect(allHrefs).toContain("/clients")
  })

  it("communicationNav contains messaging items", () => {
    expect(allHrefs).toContain("/notifications")
    expect(allHrefs).toContain("/contact-messages")
    expect(allHrefs).toContain("/chatbot")
  })

  it("systemNav contains settings", () => {
    expect(allHrefs).toContain("/settings")
  })

  it("practiceNav contains practitioner ops items", () => {
    expect(allHrefs).toContain("/ratings")
    expect(allHrefs).toContain("/intake-forms")
  })

  it("catalogNav contains directory items", () => {
    expect(allHrefs).toContain("/services")
    expect(allHrefs).toContain("/packages")
    expect(allHrefs).toContain("/categories")
    expect(allHrefs).toContain("/departments")
    expect(allHrefs).toContain("/employees")
  })
})
