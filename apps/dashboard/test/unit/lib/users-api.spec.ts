import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock, postMock, patchMock, deleteMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  patchMock: vi.fn(),
  deleteMock: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  api: { get: getMock, post: postMock, patch: patchMock, delete: deleteMock },
}))

import {
  fetchUsers,
  fetchUser,
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
} from "@/lib/api/users"

describe("users api", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fetches user list with query params", async () => {
    getMock.mockResolvedValueOnce({ items: [], meta: { total: 0 } })
    await fetchUsers({ page: 1, perPage: 20, search: "أحمد", role: "ADMIN" })
    expect(getMock).toHaveBeenCalledWith("/dashboard/identity/users", expect.objectContaining({ page: 1, search: "أحمد", role: "ADMIN" }))
  })

  it("fetches single user by id", async () => {
    getMock.mockResolvedValueOnce({ id: "u-1" })
    await fetchUser("u-1")
    expect(getMock).toHaveBeenCalledWith("/dashboard/identity/users/u-1")
  })

  it("creates a user via POST /users", async () => {
    postMock.mockResolvedValueOnce({ id: "u-2" })
    await createUser({ name: "سارة المطيري", email: "sara@clinic.com", phone: "+966500000001", password: "Pass123!", role: "RECEPTIONIST" })
    expect(postMock).toHaveBeenCalledWith("/dashboard/identity/users", expect.objectContaining({ email: "sara@clinic.com" }))
  })

  it("updates a user via PATCH /users/:id", async () => {
    patchMock.mockResolvedValueOnce({ id: "u-1" })
    await updateUser("u-1", { name: "نورة" })
    expect(patchMock).toHaveBeenCalledWith("/dashboard/identity/users/u-1", { name: "نورة" })
  })

  it("deletes a user via DELETE /users/:id", async () => {
    deleteMock.mockResolvedValueOnce(undefined)
    await deleteUser("u-1")
    expect(deleteMock).toHaveBeenCalledWith("/dashboard/identity/users/u-1")
  })

  it("activates user via PATCH /users/:id/activate", async () => {
    patchMock.mockResolvedValueOnce(undefined)
    await activateUser("u-1")
    expect(patchMock).toHaveBeenCalledWith("/dashboard/identity/users/u-1/activate")
  })

  it("deactivates user via PATCH /users/:id/deactivate", async () => {
    patchMock.mockResolvedValueOnce(undefined)
    await deactivateUser("u-1")
    expect(patchMock).toHaveBeenCalledWith("/dashboard/identity/users/u-1/deactivate")
  })

  it("assigns role to user via POST /users/:id/roles", async () => {
    postMock.mockResolvedValueOnce(undefined)
    await assignRole("u-1", { customRoleId: "r-1" })
    expect(postMock).toHaveBeenCalledWith("/dashboard/identity/users/u-1/roles", { customRoleId: "r-1" })
  })

  it("removes role from user via DELETE /users/:id/roles/:roleId", async () => {
    deleteMock.mockResolvedValueOnce(undefined)
    await removeRole("u-1", "r-1")
    expect(deleteMock).toHaveBeenCalledWith("/dashboard/identity/users/u-1/roles/r-1")
  })

  it("fetches all roles via GET /roles", async () => {
    getMock.mockResolvedValueOnce([])
    await fetchRoles()
    expect(getMock).toHaveBeenCalledWith("/dashboard/identity/roles")
  })

  it("creates a role via POST /roles", async () => {
    postMock.mockResolvedValueOnce({ id: "r-2" })
    await createRole({ name: "receptionist" })
    expect(postMock).toHaveBeenCalledWith("/dashboard/identity/roles", expect.objectContaining({ name: "receptionist" }))
  })

  it("deletes a role via DELETE /roles/:id", async () => {
    deleteMock.mockResolvedValueOnce(undefined)
    await deleteRole("r-1")
    expect(deleteMock).toHaveBeenCalledWith("/dashboard/identity/roles/r-1")
  })

  it("saves the full permission set via POST /roles/:id/permissions", async () => {
    postMock.mockResolvedValueOnce(undefined)
    await setRolePermissions("r-1", [{ subject: "Client", action: "read" }])
    expect(postMock).toHaveBeenCalledWith("/dashboard/identity/roles/r-1/permissions", {
      permissions: [{ subject: "Client", action: "read" }],
    })
  })

  it("fetches all permissions via GET /permissions", async () => {
    getMock.mockResolvedValueOnce([])
    await fetchPermissions()
    expect(getMock).toHaveBeenCalledWith("/dashboard/identity/permissions")
  })
})
