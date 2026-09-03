import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { useClients } = vi.hoisted(() => ({ useClients: vi.fn() }))
vi.mock("@/hooks/use-clients", () => ({ useClients }))
vi.mock("@/hooks/use-programs", () => ({ useEnrollClientInProgram: () => ({ mutateAsync: vi.fn() }) }))
vi.mock("@/components/locale-provider", () => ({ useLocale: () => ({ t: (k: string) => k }) }))
vi.mock("@sawaa/ui", () => {
  const Box = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>
  return { Dialog: Box, DialogContent: Box, DialogHeader: Box, DialogTitle: Box, DialogFooter: Box, DialogBody: Box, Button: (p: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...p} />, Input: (p: React.InputHTMLAttributes<HTMLInputElement>) => <input {...p} /> }
})

import { EnrollClientDialog } from "@/components/features/programs/enroll-client-dialog"

describe("EnrollClientDialog", () => {
  beforeEach(() => vi.clearAllMocks())

  it("searches on the server and exposes later client pages", () => {
    const setSearch = vi.fn()
    const setPage = vi.fn()
    useClients.mockReturnValue({ clients: [], search: "", setSearch, page: 1, setPage, isFetching: false, meta: { totalPages: 2, hasPreviousPage: false, hasNextPage: true } })
    render(<EnrollClientDialog open onOpenChange={() => {}} programId="p-1" />)
    fireEvent.change(screen.getByPlaceholderText("programs.dialog.enroll.search"), { target: { value: "Sara" } })
    expect(setSearch).toHaveBeenCalledWith("Sara")
    fireEvent.click(screen.getByRole("button", { name: "table.next" }))
    expect(setPage).toHaveBeenCalledWith(2)
  })

  it("clears a stale selection when the search changes", () => {
    const setSearch = vi.fn()
    useClients.mockReturnValue({
      clients: [{ id: "c-1", name: "Sara", phone: "0500000000" }],
      search: "",
      setSearch,
      page: 1,
      setPage: vi.fn(),
      isFetching: false,
      meta: { totalPages: 1, hasPreviousPage: false, hasNextPage: false },
    })
    render(<EnrollClientDialog open onOpenChange={() => {}} programId="p-1" />)
    fireEvent.click(screen.getByRole("button", { name: /Sara/ }))
    expect(screen.getByRole("button", { name: "programs.dialog.enroll.confirm" })).toBeEnabled()
    fireEvent.change(screen.getByPlaceholderText("programs.dialog.enroll.search"), { target: { value: "Mona" } })
    expect(screen.getByRole("button", { name: "programs.dialog.enroll.confirm" })).toBeDisabled()
  })
})
