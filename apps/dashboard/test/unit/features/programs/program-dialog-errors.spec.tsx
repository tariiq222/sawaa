import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/components/locale-provider", () => ({ useLocale: () => ({ t: (k: string) => k }) }))
vi.mock("@sawaa/ui", () => {
  const Box = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>
  return {
    Dialog: Box, DialogContent: Box, DialogHeader: Box, DialogTitle: Box,
    DialogDescription: Box, DialogFooter: Box, DialogBody: Box,
    Button: (p: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...p} />,
    Textarea: (p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} />,
    DateTimeInput: ({ onChange, ...p }: React.InputHTMLAttributes<HTMLInputElement> & { onChange: (value: string) => void }) => <input {...p} onChange={(e) => onChange(e.target.value)} />,
  }
})

import { ScheduleProgramDialog } from "@/components/features/programs/schedule-program-dialog"
import { CancelProgramDialog } from "@/components/features/programs/cancel-program-dialog"

describe("program transition dialogs", () => {
  it("shows a rejected schedule request inside the dialog", async () => {
    render(<ScheduleProgramDialog open onOpenChange={() => {}} programId="p-1" onConfirm={vi.fn().mockRejectedValue(new Error("schedule failed"))} />)
    fireEvent.change(screen.getByLabelText("programs.detail.startDate"), { target: { value: "2026-10-01T10:00" } })
    fireEvent.click(screen.getByRole("button", { name: "programs.schedule" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("common.errorLoading")
  })

  it("shows a rejected cancellation request inside the dialog", async () => {
    render(<CancelProgramDialog open onOpenChange={() => {}} onConfirm={vi.fn().mockRejectedValue(new Error("cancel failed"))} />)
    fireEvent.change(screen.getByLabelText("programs.dialog.cancel.reasonLabel"), { target: { value: "valid cancellation reason" } })
    fireEvent.click(screen.getByRole("button", { name: "programs.dialog.cancel.confirm" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("common.errorLoading")
  })
})
