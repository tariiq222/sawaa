/**
 * submitProgram — pure helper that routes the dashboard program form
 * to either createProgram (mode='create') or updateProgram
 * (mode='edit' with a programId).
 *
 * Regression coverage for the bug where `/programs/[id]/edit` submitted
 * to useCreateProgram() instead of useUpdateProgram(), producing a
 * duplicate program row instead of updating the existing one.
 */

import { describe, expect, it, vi } from "vitest"
import { submitProgram } from "@/components/features/programs/program-form-page"

const SUPERVISOR_ID = "00000000-0000-4000-a000-000000000003"
const DEPARTMENT_ID = "00000000-0000-4000-a000-000000000001"
const BRANCH_ID = "00000000-0000-4000-a000-000000000002"
const PROGRAM_ID = "00000000-4000-4000-a000-0000000000aa"

function sampleValues() {
  return {
    departmentId: DEPARTMENT_ID,
    branchId: BRANCH_ID,
    nameAr: "برنامج اختبار",
    nameEn: "",
    descriptionAr: "",
    descriptionEn: "",
    daysCount: 4,
    hoursPerDay: 2,
    minParticipants: 4,
    maxParticipants: 10,
    priceSar: 500,
    currency: "SAR",
    depositEnabled: false,
    depositSar: 0,
    isPublic: false,
    publicDescriptionAr: "",
    publicDescriptionEn: "",
    supervisorIds: [SUPERVISOR_ID],
  }
}

describe("submitProgram — mode routing", () => {
  it("create mode calls create.mutateAsync with the create payload (NOT update)", async () => {
    const create = { mutateAsync: vi.fn().mockResolvedValueOnce({ id: "new-id" }) }
    const update = { mutateAsync: vi.fn() }

    const result = await submitProgram({
      mode: "create",
      create,
      update,
      values: sampleValues(),
    })

    expect(create.mutateAsync).toHaveBeenCalledTimes(1)
    expect(create.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        departmentId: DEPARTMENT_ID,
        branchId: BRANCH_ID,
        nameAr: "برنامج اختبار",
        supervisorIds: [SUPERVISOR_ID],
      }),
    )
    expect(update.mutateAsync).not.toHaveBeenCalled()
    expect(result.id).toBe("new-id")
  })

  it("edit mode calls update.mutateAsync with the programId + payload (NOT create)", async () => {
    const create = { mutateAsync: vi.fn() }
    const update = { mutateAsync: vi.fn().mockResolvedValueOnce({ id: PROGRAM_ID }) }

    const result = await submitProgram({
      mode: "edit",
      programId: PROGRAM_ID,
      create,
      update,
      values: sampleValues(),
    })

    expect(update.mutateAsync).toHaveBeenCalledTimes(1)
    expect(update.mutateAsync).toHaveBeenCalledWith({
      id: PROGRAM_ID,
      payload: expect.objectContaining({
        departmentId: DEPARTMENT_ID,
        branchId: BRANCH_ID,
        nameAr: "برنامج اختبار",
        supervisorIds: [SUPERVISOR_ID],
      }),
    })
    expect(create.mutateAsync).not.toHaveBeenCalled()
    expect(result.id).toBe(PROGRAM_ID)
  })

  it("edit mode forwards the SAME CreateProgramPayload field shape (no field translation)", async () => {
    const create = { mutateAsync: vi.fn() }
    const update = { mutateAsync: vi.fn().mockResolvedValueOnce({ id: PROGRAM_ID }) }

    await submitProgram({
      mode: "edit",
      programId: PROGRAM_ID,
      create,
      update,
      values: sampleValues(),
    })

    const { payload } = update.mutateAsync.mock.calls[0][0]
    // The backend PATCH /dashboard/programs/:id accepts the same shape as
    // POST — both flows share the field set so the form values are reused
    // without translation.
    expect(payload).toMatchObject({
      departmentId: expect.any(String),
      branchId: expect.any(String),
      nameAr: expect.any(String),
      daysCount: expect.any(Number),
      hoursPerDay: expect.any(Number),
      minParticipants: expect.any(Number),
      maxParticipants: expect.any(Number),
      price: expect.any(Number),
      supervisorIds: expect.any(Array),
    })
  })

  it("edit mode requires a programId (throws if missing)", async () => {
    const create = { mutateAsync: vi.fn() }
    const update = { mutateAsync: vi.fn() }

    await expect(
      submitProgram({
        mode: "edit",
        // programId intentionally omitted
        create,
        update,
        values: sampleValues(),
      }),
    ).rejects.toThrow(/programId/i)
  })
})