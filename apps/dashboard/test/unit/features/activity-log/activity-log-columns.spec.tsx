import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import type { ColumnDef, Row } from "@tanstack/react-table"

import { getActivityLogColumns } from "@/components/features/activity-log/activity-log-columns"
import type { ActivityLog } from "@/lib/types/activity-log"

const t = (k: string) => k

const baseLog: ActivityLog = {
  id: "log-1",
  userId: "u-1",
  userEmail: "sara.ali@example.com",
  action: "updated",
  module: "bookings",
  resourceId: "bk-abcdef12345",
  description: "Updated booking status",
  oldValues: null,
  newValues: null,
  ipAddress: null,
  userAgent: null,
  createdAt: "2026-04-17T09:30:00Z",
  user: {
    id: "u-1",
    firstName: "Sara",
    lastName: "Ali",
  } as ActivityLog["user"],
}

type Col = ColumnDef<ActivityLog>
function fakeRow(data: ActivityLog): Row<ActivityLog> {
  return { original: data } as unknown as Row<ActivityLog>
}

function cellHtml(col: Col, data: ActivityLog) {
  // Cell can be a function; TanStack Table invokes it with the table context.
  // We only need row.original here.
  const cell = typeof col.cell === "function" ? col.cell : () => null
  // Vitest/jsdom is fine with the minimal ctx shape.
  const node = (cell as (ctx: { row: Row<ActivityLog> }) => React.ReactNode)({ row: fakeRow(data) })
  const { container } = render(<>{node}</>)
  return container
}

describe("getActivityLogColumns", () => {
  it("returns exactly 6 columns in the documented order", () => {
    const cols = getActivityLogColumns(t)
    expect(cols.map((c) => c.id ?? (c as { accessorKey?: string }).accessorKey)).toEqual([
      "user",
      "action",
      "module",
      "description",
      "resourceId",
      "createdAt",
    ])
  })

  it("renders the user's name when user is present", () => {
    const col = getActivityLogColumns(t).find((c) => c.id === "user")!
    const html = cellHtml(col, baseLog).textContent ?? ""
    expect(html).toContain("Sara Ali")
  })

  it("renders a translated system-placeholder when user is null", () => {
    const col = getActivityLogColumns(t).find((c) => c.id === "user")!
    const html = cellHtml(col, { ...baseLog, user: null as unknown as ActivityLog["user"], userEmail: null }).textContent ?? ""
    expect(html).toBe("activityLog.system")
  })

  it("applies the color class that maps to the action name", () => {
    const col = getActivityLogColumns(t).find((c) => (c as { accessorKey?: string }).accessorKey === "action")!
    const html = cellHtml(col, baseLog).innerHTML
    // "updated" maps to info-tinted classes.
    expect(html).toContain("text-info")
  })

  it("falls back to an unstyled badge when action is unknown", () => {
    const col = getActivityLogColumns(t).find((c) => (c as { accessorKey?: string }).accessorKey === "action")!
    const html = cellHtml(col, { ...baseLog, action: "mystery" }).innerHTML
    expect(html).not.toContain("text-info")
    expect(html).not.toContain("text-success")
    expect(html).toContain("mystery")
  })

  it("truncates resourceId to 8 chars and shows em-dash when null", () => {
    const col = getActivityLogColumns(t).find((c) => (c as { accessorKey?: string }).accessorKey === "resourceId")!
    expect(cellHtml(col, baseLog).textContent).toBe("bk-abcde")
    expect(cellHtml(col, { ...baseLog, resourceId: null }).textContent).toBe("—")
  })

  it("shows em-dash when description is null", () => {
    const col = getActivityLogColumns(t).find((c) => (c as { accessorKey?: string }).accessorKey === "description")!
    expect(cellHtml(col, { ...baseLog, description: null }).textContent).toBe("—")
  })

  it("renders a formatted date for createdAt", () => {
    const col = getActivityLogColumns(t).find((c) => (c as { accessorKey?: string }).accessorKey === "createdAt")!
    const text = cellHtml(col, baseLog).textContent ?? ""
    // Don't pin exact locale formatting — just ensure it includes the year.
    expect(text).toMatch(/2026/)
  })

  it("renders an em-dash instead of throwing when createdAt is invalid", () => {
    const col = getActivityLogColumns(t).find((c) => (c as { accessorKey?: string }).accessorKey === "createdAt")!
    const text = cellHtml(col, { ...baseLog, createdAt: undefined as unknown as string }).textContent ?? ""
    expect(text).toBe("—")
  })
})
