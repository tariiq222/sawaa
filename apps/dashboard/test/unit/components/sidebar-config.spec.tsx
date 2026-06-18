import { describe, expect, it } from "vitest"

import {
  receptionNav,
  practiceNav,
  catalogNav,
  managementNav,
  setupNav,
  navGroups,
} from "@/components/sidebar-config"

describe("SidebarConfig — persona groups", () => {
  const allNavItems = [
    ...receptionNav,
    ...practiceNav,
    ...catalogNav,
    ...managementNav,
    ...setupNav,
  ]

  const allHrefs = allNavItems.map((item) => item.href)

  it("no duplicate hrefs across all nav items", () => {
    const duplicates = allHrefs.filter((href, i) => allHrefs.indexOf(href) !== i)
    expect(duplicates).toHaveLength(0)
  })

  it("navGroups has all 5 persona sections", () => {
    expect(navGroups).toHaveLength(5)
    expect(navGroups.map((g) => g.labelKey)).toEqual([
      "nav.reception",
      "nav.practice",
      "nav.catalog",
      "nav.management",
      "nav.setup",
    ])
  })

  it("setupNav contains system items", () => {
    expect(allHrefs).toContain("/settings")
    expect(allHrefs).toContain("/contact-messages")
  })

  it("receptionNav contains front-desk items", () => {
    expect(allHrefs).toContain("/bookings")
    expect(allHrefs).toContain("/clients")
  })

  it("practiceNav contains practitioner ops items", () => {
    expect(allHrefs).toContain("/ratings")
    expect(allHrefs).toContain("/intake-forms")
  })

  it("catalogNav contains directory items", () => {
    expect(allHrefs).toContain("/services")
    expect(allHrefs).toContain("/bundles")
    expect(allHrefs).toContain("/categories")
    expect(allHrefs).toContain("/departments")
    expect(allHrefs).toContain("/employees")
  })
})
