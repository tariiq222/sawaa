import { act, renderHook, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

const { packageFixture } = vi.hoisted(() => ({
  packageFixture: {
    id: "package-id",
    nameAr: "باقة",
    nameEn: null,
    descriptionAr: null,
    descriptionEn: null,
    imageUrl: null,
    iconName: null,
    iconBgColor: null,
    sortOrder: 0,
    isActive: true,
    isPublic: false,
    ownerEmployeeId: null,
    items: [
      {
        serviceId: "service-id",
        employeeId: "employee-id",
        durationOptionId: "duration-id",
        constraints: [
          {
            dimension: "SERVICE",
            mode: "INCLUDE",
            targets: [{ targetId: "service-id" }],
          },
          {
            dimension: "PRACTITIONER",
            mode: "INCLUDE",
            targets: [{ targetId: "employee-id" }],
          },
          {
            dimension: "DURATION",
            mode: "INCLUDE",
            targets: [{ targetId: "duration-id" }],
          },
        ],
        unitPrice: "10000",
        label: null,
        paidQuantity: 1,
        freeQuantity: 0,
        discountType: null,
        discountValue: null,
        sortOrder: 0,
      },
      {
        serviceId: "service-id",
        employeeId: null,
        durationOptionId: null,
        constraints: [
          { dimension: "SERVICE", mode: "ANY", targets: [] },
          { dimension: "PRACTITIONER", mode: "ANY", targets: [] },
          { dimension: "DURATION", mode: "ANY", targets: [] },
        ],
        unitPrice: null,
        label: null,
        paidQuantity: 1,
        freeQuantity: 0,
        discountType: null,
        discountValue: null,
        sortOrder: 1,
      },
    ],
  },
}))

vi.mock("@/hooks/use-packages", () => ({
  usePackage: () => ({ data: packageFixture, isLoading: false }),
}))

vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({
    locale: "ar",
    dir: "rtl" as const,
    t: (key: string) => key,
    toggleLocale: vi.fn(),
  }),
}))

import { usePackageEditorState } from "@/hooks/use-package-editor-state"

describe("usePackageEditorState hydration", () => {
  it("stores inferred selection modes so dependency edits cannot re-infer them", async () => {
    const { result } = renderHook(() => usePackageEditorState("package-id"))

    await waitFor(() => {
      expect(result.current.form.getValues("items.0.selectionMode")).toBe(
        "FIXED"
      )
      expect(result.current.form.getValues("items.1.selectionMode")).toBe(
        "FLEXIBLE"
      )
    })

    act(() => {
      result.current.form.setValue("items.0.service", { mode: "ANY", ids: [] })
    })

    expect(result.current.form.getValues("items.0.selectionMode")).toBe("FIXED")
  })
})
