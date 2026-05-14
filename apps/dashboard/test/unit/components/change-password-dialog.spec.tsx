import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const changePasswordMock = vi.fn()

vi.mock("@/lib/api/auth", () => ({
  changePassword: (...args: unknown[]) => changePasswordMock(...args),
}))

vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({
    locale: "ar",
    dir: "rtl" as const,
    t: (k: string) => {
      const map: Record<string, string> = {
        "changePassword.title": "تغيير كلمة المرور",
        "changePassword.description": "أدخل كلمة المرور الحالية والجديدة",
        "changePassword.current": "الحالية",
        "changePassword.new": "الجديدة",
        "changePassword.confirm": "تأكيد",
        "changePassword.cancel": "إلغاء",
        "changePassword.submit": "حفظ",
        "changePassword.submitting": "جارٍ الحفظ...",
        "changePassword.success": "تم التغيير",
        "changePassword.error": "فشل التغيير",
      }
      return map[k] ?? k
    },
    toggleLocale: vi.fn(),
  }),
}))

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { ChangePasswordDialog } from "@/components/features/change-password-dialog"

describe("ChangePasswordDialog", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("renders when open", () => {
    render(<ChangePasswordDialog open={true} onOpenChange={vi.fn()} />)
    expect(screen.getByText("تغيير كلمة المرور")).toBeInTheDocument()
  })

  it("does not render content when closed", () => {
    render(<ChangePasswordDialog open={false} onOpenChange={vi.fn()} />)
    expect(screen.queryByText("تغيير كلمة المرور")).toBeNull()
  })

  it("renders all three password fields", () => {
    render(<ChangePasswordDialog open={true} onOpenChange={vi.fn()} />)
    const form = document.getElementById("change-password-form")
    expect(form).toBeInTheDocument()
    const inputs = form!.querySelectorAll("input")
    expect(inputs).toHaveLength(3)
  })

  it("calls onOpenChange(false) when cancel clicked", async () => {
    const onOpenChange = vi.fn()
    render(<ChangePasswordDialog open={true} onOpenChange={onOpenChange} />)

    await userEvent.click(screen.getByText("إلغاء"))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("calls changePassword on valid submit", async () => {
    changePasswordMock.mockResolvedValueOnce(undefined)
    render(<ChangePasswordDialog open={true} onOpenChange={vi.fn()} />)

    const form = document.getElementById("change-password-form") as HTMLFormElement
    const inputs = form.querySelectorAll("input")
    await userEvent.type(inputs[0], "oldpass123")
    await userEvent.type(inputs[1], "newpass123")
    await userEvent.type(inputs[2], "newpass123")

    await userEvent.click(screen.getByText("حفظ"))

    await waitFor(() => {
      expect(changePasswordMock).toHaveBeenCalledWith("oldpass123", "newpass123")
    })
  })

  it("shows error when passwords do not match", async () => {
    render(<ChangePasswordDialog open={true} onOpenChange={vi.fn()} />)

    const form = document.getElementById("change-password-form") as HTMLFormElement
    const inputs = form.querySelectorAll("input")
    await userEvent.type(inputs[0], "oldpass123")
    await userEvent.type(inputs[1], "newpass123")
    await userEvent.type(inputs[2], "different")

    await userEvent.click(screen.getByText("حفظ"))

    await waitFor(() => {
      expect(screen.getByText(/Passwords do not match/i)).toBeInTheDocument()
    })
  })

  it("shows error when new password is too short", async () => {
    render(<ChangePasswordDialog open={true} onOpenChange={vi.fn()} />)

    const form = document.getElementById("change-password-form") as HTMLFormElement
    const inputs = form.querySelectorAll("input")
    await userEvent.type(inputs[0], "oldpass123")
    await userEvent.type(inputs[1], "short")
    await userEvent.type(inputs[2], "short")

    await userEvent.click(screen.getByText("حفظ"))

    await waitFor(() => {
      expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument()
    })
  })

  it("shows error when current password is empty", async () => {
    render(<ChangePasswordDialog open={true} onOpenChange={vi.fn()} />)

    const form = document.getElementById("change-password-form") as HTMLFormElement
    const inputs = form.querySelectorAll("input")
    await userEvent.type(inputs[1], "newpass123")
    await userEvent.type(inputs[2], "newpass123")

    await userEvent.click(screen.getByText("حفظ"))

    await waitFor(() => {
      expect(screen.getByText(/Current password is required/i)).toBeInTheDocument()
    })
  })
})
