import { describe, expect, it } from "vitest"

import {
  overviewNav,
  operationsNav,
  peopleNav,
  financeNav,
  catalogNav,
  systemNav,
  navGroups,
} from "@/components/sidebar-config"

describe("SidebarConfig — groups added", () => {
  const allNavItems = [
    ...overviewNav,
    ...operationsNav,
    ...peopleNav,
    ...financeNav,
    ...catalogNav,
    ...systemNav,
  ]

  const allHrefs = allNavItems.map((item) => item.href)

  it("no duplicate hrefs across all nav items", () => {
    const duplicates = allHrefs.filter((href, i) => allHrefs.indexOf(href) !== i)
    expect(duplicates).toHaveLength(0)
  })

  it("navGroups has all 6 sections", () => {
    expect(navGroups).toHaveLength(6)
    expect(navGroups.map((g) => g.labelKey)).toEqual([
      "nav.overview",
      "nav.operations",
      "nav.people",
      "nav.finance",
      "nav.catalog",
      "nav.system",
    ])
  })

  it("catalogNav contains expected items", () => {
    expect(allHrefs).toContain("/services")
    expect(allHrefs).toContain("/categories")
    expect(allHrefs).toContain("/departments")
    expect(allHrefs).toContain("/branches")
    expect(allHrefs).toContain("/intake-forms")
  })

  it("operationsNav contains expected items", () => {
    expect(allHrefs).toContain("/bookings")
    expect(allHrefs).toContain("/clients")
    expect(allHrefs).toContain("/ratings")
    expect(allHrefs).toContain("/contact-messages")
  })
})
