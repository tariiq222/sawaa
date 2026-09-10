import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  publish: vi.fn(),
  schedule: vi.fn(),
  cancel: vi.fn(),
}))

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock("@/components/locale-provider", () => ({ useLocale: () => ({ t: (k: string) => k }) }))
vi.mock("@/hooks/use-programs", () => ({
  useProgram: () => ({ data: { id: "p-1", ref: 1, nameAr: "برنامج", status: "DRAFT", enrolledCount: 0, maxParticipants: 10, minParticipants: 1, daysCount: 1, hoursPerDay: 1, price: "0", currency: "SAR", isPublic: false, isFull: false, enrollments: [] }, isLoading: false, isError: false }),
  usePublishProgram: () => ({ mutateAsync: mocks.publish, isPending: false }),
  useScheduleProgram: () => ({ mutateAsync: mocks.schedule, isPending: false }),
  useCancelProgram: () => ({ mutateAsync: mocks.cancel, isPending: false }),
}))
vi.mock("@/components/features/programs/program-status-badge", () => ({ ProgramStatusBadge: () => <span /> }))
vi.mock("@/components/features/programs/program-enrollments-table", () => ({ ProgramEnrollmentsTable: () => <div /> }))
vi.mock("@/components/features/programs/enroll-client-dialog", () => ({ EnrollClientDialog: () => null }))
vi.mock("@/components/features/programs/schedule-program-dialog", () => ({ ScheduleProgramDialog: ({ onConfirm }: { onConfirm: (date: string) => Promise<void> }) => <button onClick={() => void onConfirm("2026-10-01")}>schedule-test</button> }))
vi.mock("@/components/features/programs/cancel-program-dialog", () => ({ CancelProgramDialog: ({ onConfirm }: { onConfirm: (reason: string) => Promise<void> }) => <button onClick={() => void onConfirm("reason")}>cancel-test</button> }))
vi.mock("@sawaa/ui", () => ({ Button: (p: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...p} /> }))

import { ProgramDetailPage } from "@/components/features/programs/program-detail-page"

describe("ProgramDetailPage transition failures", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.publish.mockRejectedValue(new Error("transition failed"))
    mocks.schedule.mockRejectedValue(new Error("transition failed"))
    mocks.cancel.mockRejectedValue(new Error("transition failed"))
  })

  it("surfaces a rejected publish transition", async () => {
    render(<ProgramDetailPage id="p-1" />)
    fireEvent.click(screen.getByRole("button", { name: "programs.publish" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("common.errorLoading")
  })
})
