import { describe, expect, it } from "vitest"

import {
  receptionNav,
  practiceNav,
  managementNav,
  setupNav,
  navGroups,
} from "@/components/sidebar-config"

describe("SidebarConfig — persona groups", () => {
  const allNavItems = [
    ...receptionNav,
    ...practiceNav,
    ...managementNav,
    ...setupNav,
  ]

  const allHrefs = allNavItems.map((item) => item.href)

  it("no duplicate hrefs across all nav items", () => {
    const duplicates = allHrefs.filter((href, i) => allHrefs.indexOf(href) !== i)
    expect(duplicates).toHaveLength(0)
  })

  it("navGroups has all 4 persona sections", () => {
    expect(navGroups).toHaveLength(4)
    expect(navGroups.map((g) => g.labelKey)).toEqual([
      "nav.reception",
      "nav.practice",
      "nav.management",
      "nav.setup",
    ])
  })

  it("setupNav contains catalog & system items", () => {
    expect(allHrefs).toContain("/services")
    expect(allHrefs).toContain("/categories")
    expect(allHrefs).toContain("/departments")
    expect(allHrefs).toContain("/settings")
  })

  it("receptionNav contains front-desk items", () => {
    expect(allHrefs).toContain("/bookings")
    expect(allHrefs).toContain("/clients")
    expect(allHrefs).toContain("/contact-messages")
  })

  it("practiceNav contains practitioner items", () => {
    expect(allHrefs).toContain("/employees")
    expect(allHrefs).toContain("/ratings")
    expect(allHrefs).toContain("/intake-forms")
  })
})
