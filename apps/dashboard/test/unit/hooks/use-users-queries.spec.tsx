import { renderHook, waitFor, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

const {
  fetchUsers,
  createUser,
  updateUser,
  deleteUser,
  activateUser,
  deactivateUser,
  assignRole,
  removeRole,
  fetchRoles,
  createRole,
  deleteRole,
  setRolePermissions,
  fetchPermissions,
} = vi.hoisted(() => ({
  fetchUsers: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  deleteUser: vi.fn(),
  activateUser: vi.fn(),
  deactivateUser: vi.fn(),
  assignRole: vi.fn(),
  removeRole: vi.fn(),
  fetchRoles: vi.fn(),
  createRole: vi.fn(),
  deleteRole: vi.fn(),
  setRolePermissions: vi.fn(),
  fetchPermissions: vi.fn(),
}))

vi.mock("@/lib/api/users", () => ({
  fetchUsers,
  createUser,
  updateUser,
  deleteUser,
  activateUser,
  deactivateUser,
  assignRole,
  removeRole,
  fetchRoles,
  createRole,
  deleteRole,
  setRolePermissions,
  fetchPermissions,
}))

import {
  useUsers,
  useRoles,
  usePermissions,
} from "@/hooks/use-users"

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function TestWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  TestWrapper.displayName = "TestWrapper"
  return TestWrapper
}

describe("useUsers", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetches users and returns items", async () => {
    const items = [{ id: "u-1", name: "Tariq" }]
    fetchUsers.mockResolvedValueOnce({ items, meta: { total: 1 } })

    const { result } = renderHook(() => useUsers(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(fetchUsers).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, perPage: 20 }),
    )
    expect(result.current.users).toEqual(items)
    expect(result.current.meta).toEqual({ total: 1 })
  })

  it("returns loading state initially", () => {
    fetchUsers.mockReturnValueOnce(new Promise(() => undefined))

    const { result } = renderHook(() => useUsers(), { wrapper: makeWrapper() })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.users).toEqual([])
  })

  it("returns empty users when api returns no items", async () => {
    fetchUsers.mockResolvedValueOnce({ items: [], meta: { total: 0 } })

    const { result } = renderHook(() => useUsers(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.users).toEqual([])
  })

  it("passes search to api and resets page", async () => {
    fetchUsers.mockResolvedValue({ items: [], meta: { total: 0 } })

    const { result } = renderHook(() => useUsers(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => { result.current.setSearch("admin") })

    await waitFor(() =>
      expect(fetchUsers).toHaveBeenCalledWith(
        expect.objectContaining({ search: "admin", page: 1 }),
      ),
    )
  })

  it("passes role filter to api and resets page", async () => {
    fetchUsers.mockResolvedValue({ items: [], meta: { total: 0 } })

    const { result } = renderHook(() => useUsers(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => { result.current.setRole("ADMIN") })

    await waitFor(() =>
      expect(fetchUsers).toHaveBeenCalledWith(
        expect.objectContaining({ role: "ADMIN", page: 1 }),
      ),
    )
  })

  it("resetFilters clears search and role", async () => {
    fetchUsers.mockResolvedValue({ items: [], meta: { total: 0 } })

    const { result } = renderHook(() => useUsers(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => { result.current.setRole("ADMIN") })
    await waitFor(() => expect(result.current.role).toBe("ADMIN"))

    act(() => { result.current.resetFilters() })
    await waitFor(() => expect(result.current.role).toBeUndefined())
    expect(result.current.search).toBe("")
    expect(result.current.page).toBe(1)
  })
})

describe("useRoles", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetches roles list", async () => {
    const roles = [{ id: "r-1", name: "admin" }]
    fetchRoles.mockResolvedValueOnce(roles)

    const { result } = renderHook(() => useRoles(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(fetchRoles).toHaveBeenCalled()
    expect(result.current.data).toEqual(roles)
  })

  it("returns loading state initially", () => {
    fetchRoles.mockReturnValueOnce(new Promise(() => undefined))

    const { result } = renderHook(() => useRoles(), { wrapper: makeWrapper() })

    expect(result.current.isLoading).toBe(true)
  })
})

describe("usePermissions", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetches permissions list", async () => {
    const perms = [{ id: "perm-1", action: "read", subject: "bookings" }]
    fetchPermissions.mockResolvedValueOnce(perms)

    const { result } = renderHook(() => usePermissions(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(fetchPermissions).toHaveBeenCalled()
    expect(result.current.data).toEqual(perms)
  })

  it("returns loading state initially", () => {
    fetchPermissions.mockReturnValueOnce(new Promise(() => undefined))

    const { result } = renderHook(() => usePermissions(), { wrapper: makeWrapper() })

    expect(result.current.isLoading).toBe(true)
  })
})
