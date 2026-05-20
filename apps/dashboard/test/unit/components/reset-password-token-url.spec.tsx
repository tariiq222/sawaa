import { render, screen, waitFor } from "@testing-library/react"
import type { ComponentProps, ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const router = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn((url: string) => {
    window.history.replaceState(null, "", url)
  }),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams(window.location.search),
}))

vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}))

vi.mock("@/lib/api/auth", () => ({
  performStaffPasswordReset: vi.fn(),
}))

vi.mock("@sawaa/ui", () => ({
  Button: ({ children, ...props }: ComponentProps<"button">) => (
    <button {...props}>{children}</button>
  ),
  Input: (props: ComponentProps<"input">) => <input {...props} />,
  Label: ({ children, ...props }: ComponentProps<"label">) => (
    <label {...props}>{children}</label>
  ),
}))

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: ReactNode; href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

import { ResetPasswordForm } from "@/components/features/reset-password-form"

describe("ResetPasswordForm token handling", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.history.pushState(
      null,
      "",
      "/reset-password?token=reset-secret-token&source=email",
    )
  })

  it("removes the reset token from the visible URL immediately after reading it", async () => {
    render(<ResetPasswordForm />)

    expect(
      screen.getByLabelText("resetPassword.newPasswordLabel"),
    ).toBeInTheDocument()

    await waitFor(() => {
      const params = new URLSearchParams(window.location.search)
      expect(params.has("token")).toBe(false)
      expect(params.get("source")).toBe("email")
    })
  })
})
