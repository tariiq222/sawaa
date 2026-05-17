import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

const { usePathname, useRouter } = vi.hoisted(() => ({
  usePathname: vi.fn(() => "/"),
  useRouter: vi.fn(() => ({ prefetch: vi.fn(), push: vi.fn() })),
}))

const { useAuth } = vi.hoisted(() => ({
  useAuth: vi.fn<() => { user: { name: string; email: string; role: string; permissions: string[] } | null; canDo: (module: string, action: string) => boolean }>(() => {
    const permissions: string[] = []
    return {
      user: {
        name: "Ali Hassan",
        email: "ali@clinic.com",
        role: "ADMIN",
        permissions,
      },
      canDo: (module: string, action: string) => permissions.includes(`${module}:${action}`),
    }
  }),
}))

const { navGroups } = vi.hoisted(() => ({
  navGroups: [
    {
      labelKey: "nav.main",
      items: [
        { titleKey: "nav.bookings", href: "/bookings", icon: {} },
        { titleKey: "nav.clients", href: "/clients", icon: {}, permission: "clients:read" },
      ],
    },
  ],
}))

const { prefetchRouteData } = vi.hoisted(() => ({
  prefetchRouteData: vi.fn(),
}))

vi.mock("next/navigation", () => ({ usePathname, useRouter }))
vi.mock("@/components/providers/auth-provider", () => ({ useAuth }))
vi.mock("@/components/sidebar-config", () => ({ navGroups }))
vi.mock("@/lib/route-prefetch", () => ({ prefetchRouteData }))

import { useSidebarNav } from "@/hooks/use-sidebar-nav"

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function TestWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  TestWrapper.displayName = "TestWrapper"
  return TestWrapper
}

describe("useSidebarNav", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    usePathname.mockReturnValue("/")
    useRouter.mockReturnValue({ prefetch: vi.fn(), push: vi.fn() })
    const _beforeEachPermissions: string[] = []
    useAuth.mockReturnValue({
      user: {
        name: "Ali Hassan",
        email: "ali@clinic.com",
        role: "ADMIN",
        permissions: _beforeEachPermissions,
      },
      canDo: (module: string, action: string) => _beforeEachPermissions.includes(`${module}:${action}`),
    })
  })

  it("returns filteredGroups with items that have no permission requirement", async () => {
    const { result } = renderHook(() => useSidebarNav(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.filteredGroups).toBeDefined())
    expect(result.current.filteredGroups).toHaveLength(1)
    const items = result.current.filteredGroups[0].items
    expect(items.some((i) => i.href === "/bookings")).toBe(true)
    expect(items.some((i) => i.href === "/clients")).toBe(false)
  })

  it("includes permission-gated items when user has the permission", async () => {
    const _gatedPermissions = ["clients:read"] as string[]
    useAuth.mockReturnValue({
      user: {
        name: "Ali Hassan",
        email: "ali@clinic.com",
        role: "ADMIN",
        permissions: _gatedPermissions,
      },
      canDo: (module: string, action: string) => _gatedPermissions.includes(`${module}:${action}`),
    })

    const { result } = renderHook(() => useSidebarNav(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.filteredGroups).toBeDefined())
    const items = result.current.filteredGroups[0].items
    expect(items.some((i) => i.href === "/clients")).toBe(true)
  })

  it("returns user display info from auth", async () => {
    const { result } = renderHook(() => useSidebarNav(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.filteredGroups).toBeDefined())
    expect(result.current.userInitials).toBe("AH")
    expect(result.current.userName).toBe("Ali Hassan")
  })

  it("isItemActive returns true for exact root path", () => {
    usePathname.mockReturnValue("/")

    const { result } = renderHook(() => useSidebarNav(), { wrapper: makeWrapper() })

    expect(result.current.isItemActive("/")).toBe(true)
    expect(result.current.isItemActive("/bookings")).toBe(false)
  })

  it("isItemActive returns true for pathname starting with href", () => {
    usePathname.mockReturnValue("/bookings/123")

    const { result } = renderHook(() => useSidebarNav(), { wrapper: makeWrapper() })

    expect(result.current.isItemActive("/bookings")).toBe(true)
  })

  it("navigate does not push when already on exact href", () => {
    const push = vi.fn()
    usePathname.mockReturnValue("/bookings")
    useRouter.mockReturnValue({ prefetch: vi.fn(), push })

    const { result } = renderHook(() => useSidebarNav(), { wrapper: makeWrapper() })

    result.current.navigate("/bookings")
    expect(push).not.toHaveBeenCalled()
  })

  it("navigate pushes when on a sub-page of the same section", () => {
    const push = vi.fn()
    usePathname.mockReturnValue("/employees/new")
    useRouter.mockReturnValue({ prefetch: vi.fn(), push })

    const { result } = renderHook(() => useSidebarNav(), { wrapper: makeWrapper() })

    result.current.navigate("/employees")
    expect(push).toHaveBeenCalledWith("/employees")
  })

  it("returns ?? for userInitials when user is null", async () => {
    useAuth.mockReturnValue({ user: null, canDo: () => false })

    const { result } = renderHook(() => useSidebarNav(), { wrapper: makeWrapper() })

    expect(result.current.userInitials).toBe("??")
    expect(result.current.userName).toBe("—")
  })
})
