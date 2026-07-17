import { describe, expect, it, vi } from "vitest"
import { toast } from "sonner"
import { ApiError } from "@/lib/api"
import {
  packageErrorTranslationKey,
  showPackageApiError,
} from "@/lib/package-errors"

describe("package API validation errors", () => {
  it.each([
    ["Session package not found", "packages.errors.notFound"],
    ["Service not found: svc-1", "packages.errors.serviceNotFound"],
    [
      "Employee does not provide this service",
      "packages.errors.employeeDoesNotProvideService",
    ],
    [
      "Duration option not found or inactive: dur-1",
      "packages.errors.durationNotFound",
    ],
    [
      "PERCENTAGE discountValue must be between 0 and 100",
      "packages.errors.discountPercentageRange",
    ],
    [
      "FIXED discountValue must not exceed the item's payable amount",
      "packages.errors.discountFixedExceedsPayable",
    ],
    [
      "Each item must have at least one session (paidQuantity + freeQuantity >= 1)",
      "packages.errors.minQuantity",
    ],
  ])("maps %s to a localized key", (message, key) => {
    expect(packageErrorTranslationKey(message)).toBe(key)
  })

  it("uses a safe localized fallback for unknown package 4xx errors", () => {
    const toastError = vi
      .spyOn(toast, "error")
      .mockImplementation(() => undefined as never)
    const t = (key: string) => key
    showPackageApiError(new ApiError(400, "Unexpected backend detail", {}), {
      fallback: "fallback",
      t,
    })
    expect(toastError).toHaveBeenCalledWith("packages.errors.apiValidation")
    toastError.mockRestore()
  })

  it("shows the permission message for a forbidden save", () => {
    const toastError = vi
      .spyOn(toast, "error")
      .mockImplementation(() => undefined as never)
    const t = (key: string) => key
    showPackageApiError(new ApiError(403, "Forbidden", {}), {
      fallback: "fallback",
      t,
    })
    expect(toastError).toHaveBeenCalledWith("common.noPermission")
    toastError.mockRestore()
  })
})
