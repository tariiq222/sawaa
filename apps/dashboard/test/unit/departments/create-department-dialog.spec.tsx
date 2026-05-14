import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

// ResizeObserver polyfill — required by Radix UI dialog in jsdom
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver

const createMutMock = vi.fn()

vi.mock("@/hooks/use-departments", () => ({
  useDepartmentMutations: () => ({
    createMut: { mutateAsync: createMutMock, isPending: false },
  }),
}))

vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({
    locale: "ar",
    dir: "rtl" as const,
    t: (k: string) => {
      const map: Record<string, string> = {
        "departments.create.title": "إنشاء قسم",
        "departments.create.description": "أضف قسمًا جديدًا",
        "departments.create.cancel": "إلغاء",
        "departments.create.submit": "حفظ",
        "departments.create.submitting": "جارٍ الحفظ...",
        "departments.create.success": "تم الإنشاء",
        "departments.create.error": "فشل الإنشاء",
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

import { CreateDepartmentDialog } from "@/components/features/departments/create-department-dialog"

const getNameEnInput = () => document.querySelector('input[name="nameEn"]') as HTMLInputElement
const getNameArInput = () => document.querySelector('input[name="nameAr"]') as HTMLInputElement
const getIconInput = () => screen.getByPlaceholderText("أيقونة")
const getSortOrderInput = () => document.querySelector('input[type="number"]') as HTMLInputElement

describe("CreateDepartmentDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createMutMock.mockResolvedValue({ id: "d-new" })
  })

  it("renders icon input field", () => {
    render(<CreateDepartmentDialog open={true} onOpenChange={vi.fn()} />)
    expect(getIconInput()).toBeInTheDocument()
  })

  it("renders sortOrder input field", () => {
    render(<CreateDepartmentDialog open={true} onOpenChange={vi.fn()} />)
    expect(getSortOrderInput()).toBeInTheDocument()
  })

  it("sortOrder defaults to 0 when not provided by user", () => {
    render(<CreateDepartmentDialog open={true} onOpenChange={vi.fn()} />)
    expect(getSortOrderInput().value).toBe("0")
  })

  it("renders all required fields alongside icon and sortOrder", () => {
    render(<CreateDepartmentDialog open={true} onOpenChange={vi.fn()} />)
    expect(getNameEnInput()).toBeInTheDocument()
    expect(getNameArInput()).toBeInTheDocument()
    expect(getIconInput()).toBeInTheDocument()
    expect(getSortOrderInput()).toBeInTheDocument()
  })

  it("submits with icon and sortOrder values in the payload", async () => {
    render(<CreateDepartmentDialog open={true} onOpenChange={vi.fn()} />)

    await userEvent.type(getNameEnInput(), "Cardiology")
    await userEvent.type(getNameArInput(), "قلبية")
    await userEvent.type(getIconInput(), "heart")
    await userEvent.clear(getSortOrderInput())
    await userEvent.type(getSortOrderInput(), "7")

    await userEvent.click(screen.getByRole("button", { name: "حفظ" }))

    await waitFor(() => {
      expect(createMutMock).toHaveBeenCalledWith(
        expect.objectContaining({
          icon: "heart",
          sortOrder: 7,
        }),
      )
    })
  })

  it("uses sortOrder 0 in payload when user does not change the field", async () => {
    render(<CreateDepartmentDialog open={true} onOpenChange={vi.fn()} />)

    await userEvent.type(getNameEnInput(), "Dermatology")
    await userEvent.type(getNameArInput(), "جلدية")

    await userEvent.click(screen.getByRole("button", { name: "حفظ" }))

    await waitFor(() => {
      expect(createMutMock).toHaveBeenCalledWith(
        expect.objectContaining({
          sortOrder: 0,
        }),
      )
    })
  })

  it("calls onOpenChange(false) on cancel", async () => {
    const onOpenChange = vi.fn()
    render(<CreateDepartmentDialog open={true} onOpenChange={onOpenChange} />)

    await userEvent.click(screen.getByRole("button", { name: "إلغاء" }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("does not render when open is false", () => {
    render(<CreateDepartmentDialog open={false} onOpenChange={vi.fn()} />)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })
})
