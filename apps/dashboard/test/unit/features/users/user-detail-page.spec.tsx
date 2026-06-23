/**
 * user-detail-page.spec.tsx — UserDetailPage: loading, success, not-found,
 * and server-error branches.
 *
 * The page is a pure composition layer over `useUser(userId)` + `useAuth` +
 * `useOrganizationConfig` + `useLocale` + `useRouter`. We mock every one of
 * those hooks directly so the assertions stay focused on branching and
 * permission gating, not on the network or on Radix portal rendering.
 *
 * Coverage:
 *   - Loading: skeleton shell, no user name rendered.
 *   - Loaded success: user name + email + phone render, Edit button is gated
 *     on `canDo("user", "update")`.
 *   - Not-found (404 ApiError): not-found banner renders, user name does NOT.
 *   - Server error (non-404): error.server banner renders, not-found message
 *     does NOT.
 */

import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import type { User } from "@/lib/types/user"

// ─── Hoisted mocks ──────────────────────────────────────────────────────────

const { useUser, useUserMutations } = vi.hoisted(() => ({
  useUser: vi.fn(),
  useUserMutations: vi.fn(),
}))

const { canDo } = vi.hoisted(() => ({
  canDo: vi.fn<(module: string, action: string) => boolean>(),
}))

const { formatDate } = vi.hoisted(() => ({
  formatDate: vi.fn<(d: Date | string) => string>(),
}))

const pushMock = vi.hoisted(() => vi.fn())

// `UserDetailPage` composes `<DeleteUserDialog>` internally — that child calls
// `useUserMutations()` from the same module, so the mock must export both
// hooks. The dialog starts closed so the mutations hook is not exercised.
vi.mock("@/hooks/use-users", () => ({
  useUser,
  useUserMutations,
}))

vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({ canDo }),
}))

vi.mock("@/hooks/use-organization-config", () => ({
  useOrganizationConfig: () => ({
    formatDate,
    dateFormat: "Y-m-d",
    timeFormat: "24h",
    weekStartDay: "sunday",
    timezone: "Asia/Riyadh",
    weekStartDayNumber: 0,
    formatTime: vi.fn(),
  }),
}))

vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        "error.server": "حدث خطأ في الخادم",
        "common.retry": "إعادة المحاولة",
        "users.detail.notFound": "المستخدم غير موجود",
        "users.detail.backToUsers": "العودة إلى المستخدمين",
        "users.detail.home": "الرئيسية",
        "users.detail.personalInfo": "المعلومات الشخصية",
        "users.detail.fullName": "الاسم",
        "users.detail.email": "البريد الإلكتروني",
        "users.detail.phone": "الهاتف",
        "users.detail.gender": "الجنس",
        "users.detail.accountInfo": "معلومات الحساب",
        "users.detail.role": "الدور",
        "users.detail.customRole": "الدور المخصص",
        "users.detail.status": "الحالة",
        "users.detail.registered": "تاريخ التسجيل",
        "users.detail.lastUpdated": "آخر تحديث",
        "users.status.active": "نشط",
        "users.status.inactive": "غير نشط",
        "users.col.edit": "تعديل",
        "users.col.delete": "حذف",
        "users.create.male": "ذكر",
        "users.create.female": "أنثى",
        "nav.users": "المستخدمون",
      }
      return map[key] ?? key
    },
    locale: "ar",
    dir: "rtl" as const,
    toggleLocale: vi.fn(),
  }),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/users/u-1",
}))

// ─── Test helpers ───────────────────────────────────────────────────────────

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "u-1",
    ref: 1,
    email: "ali@example.com",
    name: "علي",
    phone: "+966500000000",
    gender: "MALE",
    avatarUrl: null,
    isActive: true,
    role: "ADMIN",
    customRoleId: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  }
}

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function W({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
  W.displayName = "TestWrapper"
  return W
}

// Component import must come after vi.mock declarations.
import { UserDetailPage } from "@/components/features/users/user-detail-page"

describe("UserDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    formatDate.mockImplementation((d: Date | string) =>
      typeof d === "string" ? d.slice(0, 10) : d.toISOString().slice(0, 10),
    )
    // The composed <DeleteUserDialog> child calls useUserMutations() even when
    // closed — return a benign stub so it doesn't blow up.
    useUserMutations.mockReturnValue({
      deleteMut: { mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false },
    })
    // Default: full permissions. Individual tests override.
    canDo.mockReturnValue(true)
  })

  it("renders a skeleton while useUser is loading and never the user name", () => {
    useUser.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    })

    render(<UserDetailPage userId="u-1" />, { wrapper: makeWrapper() })

    // The skeleton fallback renders a heading-sized and several card-sized
    // Skeleton elements — assert their presence rather than absence of the
    // name alone, because the branch returns before any user data is read.
    const skeletons = document.querySelectorAll('[data-slot="skeleton"], .animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
    expect(screen.queryByText("علي")).not.toBeInTheDocument()
  })

  it("renders the user's name, email, phone, and the Edit button when loaded", () => {
    useUser.mockReturnValue({
      data: makeUser(),
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })

    render(<UserDetailPage userId="u-1" />, { wrapper: makeWrapper() })

    // The page header shows the user's name as the title, the email as the
    // description, and the personal info section repeats both plus phone.
    // The email and phone appear twice each (header + personal info section),
    // so assert presence via getAllByText rather than getByText.
    expect(screen.getByRole("heading", { level: 1, name: "علي" })).toBeInTheDocument()
    expect(screen.getAllByText("ali@example.com").length).toBeGreaterThan(0)
    expect(screen.getAllByText("+966500000000").length).toBeGreaterThan(0)

    // Permission gating: canDo("user", "update") was mocked true → Edit button.
    const editButtons = screen.getAllByText("تعديل")
    expect(editButtons.length).toBeGreaterThan(0)
    // canDo must have been queried with the exact permission pair.
    expect(canDo).toHaveBeenCalledWith("user", "update")
  })

  it("does not render the Edit button when canDo('user','update') is false", () => {
    useUser.mockReturnValue({
      data: makeUser(),
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
    canDo.mockImplementation((mod, act) => mod === "user" && act === "delete")

    render(<UserDetailPage userId="u-1" />, { wrapper: makeWrapper() })

    // Edit gated off, Delete gated on — exactly one button (Delete) with the
    // localized label.
    expect(screen.queryByText("تعديل")).not.toBeInTheDocument()
    expect(screen.getByText("حذف")).toBeInTheDocument()
    expect(canDo).toHaveBeenCalledWith("user", "update")
    expect(canDo).toHaveBeenCalledWith("user", "delete")
  })

  it("renders the not-found banner when useUser surfaces a 404 ApiError", async () => {
    const { ApiError } = await import("@/lib/api")
    useUser.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new ApiError(404, "Not Found", {}),
      refetch: vi.fn(),
    })

    render(<UserDetailPage userId="missing" />, { wrapper: makeWrapper() })

    // Localized not-found copy renders; user name does NOT.
    expect(screen.getByText("المستخدم غير موجود")).toBeInTheDocument()
    expect(screen.getByText("العودة إلى المستخدمين")).toBeInTheDocument()
    expect(screen.queryByText("علي")).not.toBeInTheDocument()

    // The not-found branch never renders the server-error banner.
    expect(screen.queryByText("حدث خطأ في الخادم")).not.toBeInTheDocument()
  })

  it("renders the server-error banner with a retry button when a non-404 error is present", async () => {
    const { ApiError } = await import("@/lib/api")
    const refetch = vi.fn()
    useUser.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new ApiError(500, "Server Error", {}),
      refetch,
    })

    render(<UserDetailPage userId="u-1" />, { wrapper: makeWrapper() })

    // Error banner with the localized server-error copy.
    const alert = screen.getByRole("alert")
    expect(alert).toHaveTextContent("حدث خطأ في الخادم")

    // The ErrorBanner's retry button calls the refetch from useUser.
    const retryButton = screen.getByText("إعادة المحاولة")
    retryButton.click()
    expect(refetch).toHaveBeenCalledTimes(1)

    // Server-error branch must NOT render the not-found message.
    expect(screen.queryByText("المستخدم غير موجود")).not.toBeInTheDocument()
  })
})
