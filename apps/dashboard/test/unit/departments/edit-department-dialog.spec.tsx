import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Department } from "@/lib/types/department"

// ResizeObserver polyfill — required by Radix UI dialog in jsdom
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver

const updateMutMock = vi.fn()

vi.mock("@/hooks/use-departments", () => ({
  useDepartmentMutations: () => ({
    updateMut: { mutateAsync: updateMutMock, isPending: false },
  }),
}))

vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({
    locale: "ar",
    dir: "rtl" as const,
    t: (k: string) => {
      const map: Record<string, string> = {
        "departments.edit.title": "تعديل القسم",
        "departments.edit.cancel": "إلغاء",
        "departments.edit.submit": "حفظ",
        "departments.edit.submitting": "جارٍ التعديل...",
        "departments.edit.success": "تم التعديل",
        "departments.edit.error": "فشل التعديل",
        "departments.field.nameEn": "الاسم بالإنجليزية",
        "departments.field.nameAr": "الاسم بالعربية",
        "departments.field.descriptionEn": "الوصف بالإنجليزية",
        "departments.field.descriptionAr": "بالعربية",
        "departments.field.icon": "الأيقونة",
        "departments.field.iconPlaceholder": "أيقونة",
        "departments.field.sortOrder": "ترتيب الفرز",
        "departments.field.isActive": "نشط",
      }
      return map[k] ?? k
    },
  }),
}))

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { EditDepartmentDialog } from "@/components/features/departments/edit-department-dialog"

const mockDepartment: Department = {
  id: "d-1",
  nameAr: "قلبية",
  nameEn: "Cardiology",
  descriptionAr: "قسم القلب",
  descriptionEn: "Heart department",
  icon: "heart",
  sortOrder: 5,
  isActive: true,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
}

// Use placeholder text to find inputs since they lack explicit ids
const getIconInput = () => screen.getByPlaceholderText("أيقونة")
const getSortOrderInput = () => document.querySelector('input[type="number"]') as HTMLInputElement

describe("EditDepartmentDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    updateMutMock.mockResolvedValue({ id: "d-1" })
  })

  it("populates icon field from department prop", () => {
    render(
      <EditDepartmentDialog
        department={mockDepartment}
        open={true}
        onOpenChange={vi.fn()}
      />,
    )
    expect(getIconInput()).toHaveValue("heart")
  })

  it("populates sortOrder field from department prop", () => {
    render(
      <EditDepartmentDialog
        department={mockDepartment}
        open={true}
        onOpenChange={vi.fn()}
      />,
    )
    expect(getSortOrderInput()).toHaveValue(5)
  })

  it("uses 0 when department.sortOrder is undefined", () => {
    const deptWithoutSortOrder: Department = {
      ...mockDepartment,
      sortOrder: undefined as unknown as number,
    }

    render(
      <EditDepartmentDialog
        department={deptWithoutSortOrder}
        open={true}
        onOpenChange={vi.fn()}
      />,
    )

    expect(getSortOrderInput()).toHaveValue(0)
  })

  it("uses 0 when department is null (form defaults)", () => {
    render(
      <EditDepartmentDialog
        department={null}
        open={true}
        onOpenChange={vi.fn()}
      />,
    )

    // When department is null, neither useEffect branch fires,
    // so the form keeps its defaultValues where sortOrder is 0
    expect(getSortOrderInput()).toHaveValue(0)
  })

  it("includes icon and sortOrder in the update payload", async () => {
    render(
      <EditDepartmentDialog
        department={mockDepartment}
        open={true}
        onOpenChange={vi.fn()}
      />,
    )

    const nameEnInput = document.querySelector('input[name="nameEn"]') as HTMLInputElement
    await userEvent.clear(nameEnInput)
    await userEvent.type(nameEnInput, "Updated Name")

    await userEvent.click(screen.getByRole("button", { name: "حفظ" }))

    await waitFor(() => {
      expect(updateMutMock).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "d-1",
          icon: "heart",
          sortOrder: 5,
        }),
      )
    })
  })

  it("submits updated sortOrder when user changes it", async () => {
    render(
      <EditDepartmentDialog
        department={mockDepartment}
        open={true}
        onOpenChange={vi.fn()}
      />,
    )

    const sortInput = getSortOrderInput() as HTMLInputElement
    await userEvent.clear(sortInput)
    await userEvent.type(sortInput, "12")

    await userEvent.click(screen.getByRole("button", { name: "حفظ" }))

    await waitFor(() => {
      expect(updateMutMock).toHaveBeenCalledWith(
        expect.objectContaining({
          sortOrder: 12,
        }),
      )
    })
  })

  it("does not render when open is false", () => {
    render(
      <EditDepartmentDialog
        department={mockDepartment}
        open={false}
        onOpenChange={vi.fn()}
      />,
    )
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("calls onOpenChange(false) on cancel", async () => {
    const onOpenChange = vi.fn()
    render(
      <EditDepartmentDialog
        department={mockDepartment}
        open={true}
        onOpenChange={onOpenChange}
      />,
    )

    await userEvent.click(screen.getByRole("button", { name: "إلغاء" }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
