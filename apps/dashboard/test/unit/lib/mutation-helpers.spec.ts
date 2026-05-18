import { describe, expect, it, vi, beforeEach } from "vitest"
import { toastApiError } from "@/lib/mutation-helpers"
import { ApiError } from "@/lib/api"

const { toast } = vi.hoisted(() => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock("sonner", () => ({ toast }))

describe("toastApiError", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("shows toast with ApiError message when error is ApiError", () => {
    const handler = toastApiError("Fallback message")
    const error = new ApiError(400, "Invalid input", {})
    handler(error)
    expect(toast.error).toHaveBeenCalledWith("Invalid input")
  })

  it("shows toast with fallback message for non-ApiError", () => {
    const handler = toastApiError("فشل حفظ البيانات")
    handler(new Error("Network failure"))
    expect(toast.error).toHaveBeenCalledWith("فشل حفظ البيانات")
  })

  it("shows fallback for unknown error type", () => {
    const handler = toastApiError("Something went wrong")
    handler("string error")
    expect(toast.error).toHaveBeenCalledWith("Something went wrong")
  })
})
