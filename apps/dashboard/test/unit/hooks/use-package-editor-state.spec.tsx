import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { packageFixture, queryState } = vi.hoisted(() => ({
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
  queryState: {
    data: null as unknown,
    isLoading: false,
  },
}))

vi.mock("@/hooks/use-packages", () => ({
  usePackage: () => queryState,
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

beforeEach(() => {
  queryState.data = packageFixture
  queryState.isLoading = false
})

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

  it("keeps unsaved edits when the same package refetches with a rotated image URL", async () => {
    const { result, rerender } = renderHook(() =>
      usePackageEditorState("package-id")
    )

    await waitFor(() =>
      expect(result.current.form.getValues("nameAr")).toBe("باقة")
    )

    act(() => {
      result.current.form.setValue("nameAr", "باقة معدّلة", {
        shouldDirty: true,
      })
    })

    // The user has not touched the image, so the form still holds the server
    // link (t14 only guards images the user owns).
    act(() => {
      result.current.form.setValue(
        "imageUrl",
        "https://media.example/image.png?signature=original"
      )
    })

    // Signed-image refetch: brand-new object, same id, rotated presigned link.
    queryState.data = {
      ...packageFixture,
      nameAr: "باقة",
      imageUrl: "https://media.example/image.png?signature=rotated",
    }
    rerender()

    await waitFor(() =>
      expect(result.current.form.getValues("imageUrl")).toBe(
        "https://media.example/image.png?signature=rotated"
      )
    )
    // User edits survive the refetch.
    expect(result.current.form.getValues("nameAr")).toBe("باقة معدّلة")
    expect(result.current.form.getValues("items")).toHaveLength(2)
    expect(result.current.form.getValues("items.0.selectionMode")).toBe("FIXED")
  })

  it("still hydrates fully when the package id changes", async () => {
    const { result, rerender } = renderHook(
      ({ id }: { id: string }) => usePackageEditorState(id),
      { initialProps: { id: "package-id" } }
    )

    await waitFor(() =>
      expect(result.current.form.getValues("nameAr")).toBe("باقة")
    )

    act(() => {
      result.current.form.setValue("nameAr", "تعديل غير محفوظ", {
        shouldDirty: true,
      })
    })

    queryState.data = {
      ...packageFixture,
      id: "other-package-id",
      nameAr: "باقة أخرى",
      imageUrl: "https://media.example/other.png?signature=new",
      items: [],
    }
    rerender({ id: "other-package-id" })

    await waitFor(() =>
      expect(result.current.form.getValues("nameAr")).toBe("باقة أخرى")
    )
    expect(result.current.form.getValues("imageUrl")).toBe(
      "https://media.example/other.png?signature=new"
    )
    expect(result.current.form.getValues("items")).toHaveLength(0)
  })

  it("keeps a pending user file when the same package refetches with a rotated image URL", async () => {
    const { result, rerender } = renderHook(() =>
      usePackageEditorState("package-id")
    )

    await waitFor(() =>
      expect(result.current.form.getValues("nameAr")).toBe("باقة")
    )

    const file = new File(["avatar"], "avatar.png", { type: "image/png" })
    const blobUrl = "blob:http://localhost/pending-avatar"
    act(() => {
      result.current.onImageSelect(file)
      result.current.form.setValue("imageUrl", blobUrl, { shouldDirty: true })
    })

    queryState.data = {
      ...packageFixture,
      imageUrl: "https://media.example/image.png?signature=rotated",
    }
    rerender()

    await waitFor(() =>
      expect(result.current.pendingAvatarFile.current).toBe(file)
    )
    expect(result.current.form.getValues("imageUrl")).toBe(blobUrl)
  })

  it("keeps an explicit image removal when the same package refetches", async () => {
    queryState.data = {
      ...packageFixture,
      imageUrl: "https://media.example/image.png?signature=initial",
    }
    const { result, rerender } = renderHook(() =>
      usePackageEditorState("package-id")
    )

    await waitFor(() =>
      expect(result.current.form.getValues("imageUrl")).toBe(
        "https://media.example/image.png?signature=initial"
      )
    )

    act(() => {
      result.current.form.setValue("imageUrl", null, { shouldDirty: true })
    })

    queryState.data = {
      ...packageFixture,
      imageUrl: "https://media.example/image.png?signature=rotated",
    }
    rerender()

    await waitFor(() =>
      expect(result.current.pendingAvatarFile.current).toBeNull()
    )
    expect(result.current.form.getValues("imageUrl")).toBeNull()
  })

  it("refreshes imageUrl on refetch when the user owns no image state", async () => {
    queryState.data = {
      ...packageFixture,
      imageUrl: "https://media.example/image.png?signature=initial",
    }
    const { result, rerender } = renderHook(() =>
      usePackageEditorState("package-id")
    )

    await waitFor(() =>
      expect(result.current.form.getValues("imageUrl")).toBe(
        "https://media.example/image.png?signature=initial"
      )
    )

    queryState.data = {
      ...packageFixture,
      imageUrl: "https://media.example/image.png?signature=rotated",
    }
    rerender()

    await waitFor(() =>
      expect(result.current.form.getValues("imageUrl")).toBe(
        "https://media.example/image.png?signature=rotated"
      )
    )
  })
})
