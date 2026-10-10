import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
const state = vi.hoisted(() => ({ query: vi.fn(), loading: false }))
vi.mock("@/hooks/use-programs", () => ({ usePrograms: (q: unknown) => { state.query(q); return { data: [], isLoading: state.loading, isError: false } } }))
vi.mock("@/components/locale-provider", () => ({ useLocale: () => ({ t: (k: string) => k, locale: "ar" }) }))
import { ProgramsPageContent } from "@/components/features/programs/programs-page-content"
import { ProgramStatusBadge } from "@/components/features/programs/program-status-badge"
import { programColumns } from "@/components/features/programs/program-columns"
import { ProgramEnrollmentsTable } from "@/components/features/programs/program-enrollments-table"

describe("program audit navigation and visibility", () => {
  it("renders every status filter even when the selected status has no programs", () => {
    const change = vi.fn()
    render(<ProgramsPageContent statusFilter="ALL" onStatusFilterChange={change} />)
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "DRAFT" } })
    expect(change).toHaveBeenCalledWith("DRAFT")
    expect(screen.getByRole("option", { name: "programs.status.CANCELLED" })).toBeVisible()
    expect(state.query).toHaveBeenCalledWith({})
  })
  it("shows loading instead of an empty table", () => {
    state.loading = true
    render(<ProgramsPageContent statusFilter="ALL" onStatusFilterChange={vi.fn()} />)
    expect(screen.getByRole("status")).toHaveTextContent("common.loading")
    state.loading = false
  })
  it("uses a real details link for program names", () => {
    const col = programColumns({ onSelect: vi.fn(), t: k => k }).find(c => c.id === "name")!
    const Cell = col.cell as React.ComponentType<{row: {original: unknown}}>
    render(<Cell row={{ original: { id: "p1", nameAr: "برنامج" } }} />)
    expect(screen.getByRole("link", { name: "برنامج" })).toHaveAttribute("href", "/programs/p1")
  })
  it("preserves cancelled status for a formerly full program", () => {
    render(<ProgramStatusBadge status="CANCELLED" enrolledCount={10} maxParticipants={10} t={k => k} />)
    expect(screen.getByText("programs.status.CANCELLED")).toBeVisible()
    expect(screen.queryByText("programs.fullBadge")).toBeNull()
  })
  it("shows the enrolled client name instead of their record id", () => {
    render(<ProgramEnrollmentsTable enrollments={[{id: "e1", clientId: "abcdefg123", clientName: "سارة", enrolledAt: "2026-10-01", booking: {id:"b1", clientId:"abcdefg123", price:"100", status:"CONFIRMED", currency:"SAR", scheduledAt:"2026-10-01", bookingNumber:1}}] as never} />)
    expect(screen.getByText("سارة")).toBeVisible()
    expect(screen.queryByText(/abcdefg/)).toBeNull()
  })
})
