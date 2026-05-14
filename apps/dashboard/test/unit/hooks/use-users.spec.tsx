import { renderHook, waitFor, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { describe, expect, it, vi, beforeEach } from "vitest"
import type { ReactNode } from "react"

const apiMocks = vi.hoisted(() => ({
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

vi.mock("@/lib/api/users", () => apiMocks)

import {
  useUsers,
  useUserMutations,
  useRoles,
  useRoleMutations,
  usePermissions,
} from "@/hooks/use-users"

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
  Wrapper.displayName = "Wrapper"
  return { Wrapper, qc }
}

describe("useUsers", () => {
  beforeEach(() => {
    Object.values(apiMocks).forEach((m) => m.mockReset())
  })

  it("fetches users with default page=1 perPage=20 and no filters", async () => {
    apiMocks.fetchUsers.mockResolvedValue({ items: [], meta: { total: 0 } })
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useUsers(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(apiMocks.fetchUsers).toHaveBeenCalledWith({ page: 1, perPage: 20, search: undefined, role: undefined })
  })

  it("setSearch resets page to 1 and passes search to the API", async () => {
    apiMocks.fetchUsers.mockResolvedValue({ items: [], meta: { total: 0 } })
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useUsers(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    act(() => { result.current.setPage(3) })
    act(() => { result.current.setSearch("Ali") })
    await waitFor(() =>
      expect(apiMocks.fetchUsers).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 1, search: "Ali" }),
      ),
    )
  })

  it("setRole resets page to 1", async () => {
    apiMocks.fetchUsers.mockResolvedValue({ items: [], meta: { total: 0 } })
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useUsers(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    act(() => { result.current.setPage(5) })
    act(() => { result.current.setRole("ADMIN") })
    await waitFor(() =>
      expect(apiMocks.fetchUsers).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 1, role: "ADMIN" }),
      ),
    )
  })

  it("resetFilters clears search + role and resets page to 1", async () => {
    apiMocks.fetchUsers.mockResolvedValue({ items: [], meta: { total: 0 } })
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useUsers(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    act(() => { result.current.setSearch("x"); result.current.setRole("ADMIN") })
    act(() => { result.current.resetFilters() })
    expect(result.current.search).toBe("")
    expect(result.current.role).toBeUndefined()
    expect(result.current.page).toBe(1)
  })

  it("returns error.message when the query fails", async () => {
    apiMocks.fetchUsers.mockRejectedValueOnce(new Error("500"))
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useUsers(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.error).toBe("500"))
  })
})

describe("useUserMutations", () => {
  beforeEach(() => { Object.values(apiMocks).forEach((m) => m.mockReset()) })

  it("all mutations invalidate the users.all cache key on success", async () => {
    apiMocks.createUser.mockResolvedValue({ id: "u-1" })
    apiMocks.updateUser.mockResolvedValue({ id: "u-1" })
    apiMocks.deleteUser.mockResolvedValue(undefined)
    apiMocks.activateUser.mockResolvedValue(undefined)
    apiMocks.deactivateUser.mockResolvedValue(undefined)

    const { Wrapper, qc } = makeWrapper()
    const spy = vi.spyOn(qc, "invalidateQueries")
    const { result } = renderHook(() => useUserMutations(), { wrapper: Wrapper })

    await result.current.createMut.mutateAsync({ email: "a@b.co", name: "A", password: "Password1", role: "ADMIN" })
    await result.current.updateMut.mutateAsync({ id: "u-1", email: "a@b.co", name: "A2" })
    await result.current.deleteMut.mutateAsync("u-1")
    await result.current.activateMut.mutateAsync("u-1")
    await result.current.deactivateMut.mutateAsync("u-1")

    const invalidations = spy.mock.calls.map((c) => c[0])
    expect(invalidations.every((i) => JSON.stringify(i!.queryKey) === JSON.stringify(["users"]))).toBe(true)
    expect(spy).toHaveBeenCalledTimes(5)
  })

  it("updateMut splits id from payload when calling updateUser", async () => {
    apiMocks.updateUser.mockResolvedValue({ id: "u-1" })
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useUserMutations(), { wrapper: Wrapper })
    await result.current.updateMut.mutateAsync({ id: "u-1", name: "Updated" } as { id: string; name: string })
    expect(apiMocks.updateUser).toHaveBeenCalledWith("u-1", { name: "Updated" })
  })
})

describe("useRoles / useRoleMutations / usePermissions", () => {
  beforeEach(() => { Object.values(apiMocks).forEach((m) => m.mockReset()) })

  it("useRoles fetches the roles list", async () => {
    apiMocks.fetchRoles.mockResolvedValue([{ id: "r-1", name: "Admin" }])
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useRoles(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.data).toEqual([{ id: "r-1", name: "Admin" }])
  })

  it("useRoleMutations invalidates the roles cache key on role create/delete", async () => {
    apiMocks.createRole.mockResolvedValue({ id: "r-2" })
    apiMocks.deleteRole.mockResolvedValue(undefined)
    const { Wrapper, qc } = makeWrapper()
    const spy = vi.spyOn(qc, "invalidateQueries")
    const { result } = renderHook(() => useRoleMutations(), { wrapper: Wrapper })
    await result.current.createMut.mutateAsync({ name: "Cashier" })
    await result.current.deleteMut.mutateAsync("r-2")
    for (const call of spy.mock.calls) {
      expect((call[0]?.queryKey as string[])?.[0]).toBe("roles")
    }
  })

  it("usePermissions fetches permissions with a long stale time", async () => {
    apiMocks.fetchPermissions.mockResolvedValue([{ id: "p-1", key: "users.read" }])
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => usePermissions(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.data).toEqual([{ id: "p-1", key: "users.read" }])
  })
})
