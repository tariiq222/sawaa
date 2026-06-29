/**
 * user-list-pagination.test.tsx
 *
 * Regression test for P1-24: the users list rendered <DataTable> WITHOUT
 * `serverPaginated`, so it fell back to client-side pagination over the single
 * server page (20 rows) and never wired `onPageChange` to the hook's `setPage`.
 * Result: the user could not reach rows past the first 20, and a duplicate
 * client pager could appear.
 *
 * This test captures the props the page passes to DataTable and asserts that
 * server pagination is enabled, the server `meta` drives page/totalPages, and
 * `onPageChange` is wired to the hook's `setPage` so later pages are reachable.
 */

import React from "react"
import { render } from "@testing-library/react"
import { vi, test, expect, beforeEach } from "vitest"
import type { ComponentProps } from "react"

/* ─── Capture DataTable props ─── */

let lastDataTableProps: ComponentProps<typeof import("@/components/features/data-table").DataTable> | null = null

vi.mock("@/components/features/data-table", () => ({
  DataTable: (props: Record<string, unknown>) => {
    lastDataTableProps = props as never
    return <div data-testid="data-table" />
  },
}))

/* ─── Locale stub ─── */

vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({ t: (k: string) => k, locale: "ar" }),
}))

/* ─── Auth stub — grant everything ─── */

vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({ canDo: () => true }),
}))

/* ─── Router stub ─── */

const replaceMock = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: replaceMock }),
  useSearchParams: () => new URLSearchParams(""),
}))

/* ─── Columns / dialogs / shells — render-inert ─── */

vi.mock("@/components/features/users/user-columns", () => ({ getUserColumns: () => [] }))
vi.mock("@/components/features/users/roles-tab", () => ({ RolesTab: () => null }))
vi.mock("@/components/features/users/delete-user-dialog", () => ({ DeleteUserDialog: () => null }))
vi.mock("@/components/features/users/create-role-dialog", () => ({ CreateRoleDialog: () => null }))
vi.mock("@/components/features/list-page-shell", () => ({ ListPageShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }))
vi.mock("@/components/features/error-banner", () => ({ ErrorBanner: () => null }))
vi.mock("@/components/features/page-header", () => ({ PageHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }))
vi.mock("@/components/features/filter-bar", () => ({ FilterBar: () => null }))
vi.mock("@/components/features/breadcrumbs", () => ({ Breadcrumbs: () => null }))
vi.mock("@hugeicons/react", () => ({ HugeiconsIcon: () => null }))

vi.mock("@sawaa/ui", () => ({
  Button: ({ children }: { children?: React.ReactNode }) => <button>{children}</button>,
  Skeleton: () => <div />,
  Tabs: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

/* ─── Hook mock ─── */

vi.mock("@/hooks/use-users", () => ({
  useUsers: vi.fn(),
  useUserMutations: () => ({ activateMut: { mutateAsync: vi.fn() }, deactivateMut: { mutateAsync: vi.fn() } }),
}))

import { useUsers } from "@/hooks/use-users"
import { UserListPage } from "@/components/features/users/user-list-page"

const mockUseUsers = vi.mocked(useUsers)
const setPage = vi.fn()

beforeEach(() => {
  lastDataTableProps = null
  setPage.mockClear()
  // A multi-page result: 45 users across 3 pages of 20, currently on page 1.
  mockUseUsers.mockReturnValue({
    users: Array.from({ length: 20 }, (_, i) => ({ id: `u${i}`, ref: i })),
    meta: { total: 45, page: 1, limit: 20, totalPages: 3, hasNextPage: true, hasPreviousPage: false },
    isLoading: false,
    error: null,
    search: "",
    setSearch: vi.fn(),
    page: 1,
    setPage,
  } as unknown as ReturnType<typeof useUsers>)
})

test("renders the users DataTable with server pagination wired to the hook", () => {
  render(<UserListPage />)

  expect(lastDataTableProps).not.toBeNull()
  const props = lastDataTableProps as unknown as Record<string, unknown>

  // The bug: serverPaginated was missing → client pagination over one page.
  expect(props.serverPaginated).toBe(true)
  // Server meta must drive paging so pages past the first are reachable.
  expect(props.page).toBe(1)
  expect(props.totalPages).toBe(3)
  expect(props.hasNextPage).toBe(true)
  expect(props.hasPreviousPage).toBe(false)
  // onPageChange must be the hook's setPage so Next actually advances.
  expect(typeof props.onPageChange).toBe("function")
  ;(props.onPageChange as (p: number) => void)(2)
  expect(setPage).toHaveBeenCalledWith(2)
})
