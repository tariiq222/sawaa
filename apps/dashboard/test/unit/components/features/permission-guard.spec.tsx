/**
 * PermissionGuard — unit tests
 *
 * Covers:
 *  - Renders children when `canDo(module, action)` returns true
 *  - Renders the localized no-permission fallback when `canDo` returns false
 *  - Wires `canDo` with the exact (module, action) pair from props
 *  - Wires `canDo` to the permission source (useAuth), not internal logic
 *  - Localized fallback message renders in the active locale
 *  - Falls back to "no permission" copy in English when locale is "en"
 *
 * The guard is intentionally tiny: it delegates the entire permission
 * decision to the caller-supplied `canDo`. We mock `useAuth` (the only
 * permission source) and assert that the component queries it with the
 * exact (module, action) pair and respects the boolean it gets back.
 */

import { describe, expect, it, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"

const mockCanDo = vi.fn<(module: string, action: string) => boolean>()

vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({ canDo: mockCanDo }),
}))

// Locale is mocked so we don't depend on a translation provider. The guard
// itself only calls t("common.noPermission") — we just need the call shape
// and any localized string to verify.
const localeState = vi.fn(() => "ar" as "ar" | "en")
vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({
    locale: localeState(),
    dir: localeState() === "ar" ? ("rtl" as const) : ("ltr" as const),
    t: (k: string) =>
      k === "common.noPermission"
        ? localeState() === "ar"
          ? "ليس لديك صلاحية للوصول لهذه الصفحة"
          : "You don't have permission to access this page"
        : k,
    toggleLocale: vi.fn(),
  }),
}))

// next/link + next/navigation are pulled in transitively via Breadcrumbs.
// Render the guard with a pathname of "/" so the auto-generated breadcrumbs
// collapse to a single root item and render null — keeps the snapshot clean.
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}))

import { PermissionGuard } from "@/components/features/permission-guard"

beforeEach(() => {
  mockCanDo.mockReset()
  localeState.mockReturnValue("ar")
})

describe("PermissionGuard", () => {
  it("renders children when canDo(module, action) is true", () => {
    mockCanDo.mockReturnValue(true)

    render(
      <PermissionGuard module="bookings" action="read">
        <div data-testid="protected-content">protected</div>
      </PermissionGuard>,
    )

    expect(screen.getByTestId("protected-content")).toBeInTheDocument()
    expect(screen.getByText("protected")).toBeInTheDocument()
  })

  it("queries canDo with the exact (module, action) pair from props", () => {
    mockCanDo.mockReturnValue(true)

    render(
      <PermissionGuard module="invoices" action="write">
        <span>ok</span>
      </PermissionGuard>,
    )

    expect(mockCanDo).toHaveBeenCalledWith("invoices", "write")
  })

  it("renders the localized no-permission fallback when canDo is false (ar)", () => {
    mockCanDo.mockReturnValue(false)
    localeState.mockReturnValue("ar")

    render(
      <PermissionGuard module="users" action="delete">
        <div data-testid="protected-content">should not render</div>
      </PermissionGuard>,
    )

    expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument()
    expect(
      screen.getByText("ليس لديك صلاحية للوصول لهذه الصفحة"),
    ).toBeInTheDocument()
  })

  it("renders the English no-permission fallback when locale is en", () => {
    mockCanDo.mockReturnValue(false)
    localeState.mockReturnValue("en")

    render(
      <PermissionGuard module="users" action="delete">
        <div data-testid="protected-content">should not render</div>
      </PermissionGuard>,
    )

    expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument()
    expect(
      screen.getByText("You don't have permission to access this page"),
    ).toBeInTheDocument()
  })

  it("does not render children even when canDo is false", () => {
    mockCanDo.mockReturnValue(false)

    render(
      <PermissionGuard module="branches" action="delete">
        <button>Secret Action</button>
      </PermissionGuard>,
    )

    expect(screen.queryByText("Secret Action")).not.toBeInTheDocument()
  })

  it("queries canDo for each render — relies on useAuth, not internal cache", () => {
    mockCanDo.mockReturnValueOnce(false).mockReturnValueOnce(true)

    const { rerender } = render(
      <PermissionGuard module="clients" action="read">
        <div data-testid="c1">first</div>
      </PermissionGuard>,
    )

    expect(mockCanDo).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId("c1")).not.toBeInTheDocument()

    rerender(
      <PermissionGuard module="clients" action="read">
        <div data-testid="c2">second</div>
      </PermissionGuard>,
    )

    expect(mockCanDo).toHaveBeenCalledTimes(2)
    // Second call returned true → children render
    expect(screen.getByTestId("c2")).toBeInTheDocument()
  })

  it("does not render the fallback message when canDo is true", () => {
    mockCanDo.mockReturnValue(true)
    localeState.mockReturnValue("ar")

    render(
      <PermissionGuard module="reports" action="read">
        <div>ok</div>
      </PermissionGuard>,
    )

    expect(
      screen.queryByText("ليس لديك صلاحية للوصول لهذه الصفحة"),
    ).not.toBeInTheDocument()
  })
})
