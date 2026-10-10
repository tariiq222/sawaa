import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock, postMock, patchMock, deleteMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  patchMock: vi.fn(),
  deleteMock: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  api: {
    get: getMock,
    post: postMock,
    patch: patchMock,
    delete: deleteMock,
  },
}))

import {
  createWalkInClient,
  deleteClient,
  fetchClient,
  fetchClients,
  setClientActive,
  updateClient,
} from "@/lib/api/clients"

describe("clients api", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fetches client list with pagination and search params", async () => {
    getMock.mockResolvedValueOnce({ items: [], meta: { total: 0 } })

    await fetchClients({ page: 2, limit: 10, search: "محمد" })

    expect(getMock).toHaveBeenCalledWith(
      "/dashboard/people/clients?page=2&limit=10&search=%D9%85%D8%AD%D9%85%D8%AF",
    )
  })

  it("forwards server sorting with pagination rather than sorting fetched rows", async () => {
    getMock.mockResolvedValueOnce({ items: [], meta: { total: 0 } })
    await fetchClients({ page: 2, sortBy: "name", sortOrder: "asc" })
    expect(getMock).toHaveBeenCalledWith("/dashboard/people/clients?page=2&sortBy=name&sortOrder=asc")
  })

  it("normalizes nullable OpenAPI client fields to the public Client signature", async () => {
    getMock.mockResolvedValueOnce({
      items: [
        {
          id: "client-1",
          ref: 1024,
          email: null,
          firstName: null,
          lastName: null,
          phone: null,
          gender: null,
          name: "",
          isActive: true,
          emailVerified: null,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          accountType: "walk_in",
          avatarUrl: null,
          dateOfBirth: null,
        },
      ],
      meta: {
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    })

    const result = await fetchClients()

    expect(result.items[0]).toMatchObject({
      firstName: "",
      lastName: "",
      emailVerified: false,
    })
  })

  it("fetches client detail by id", async () => {
    getMock.mockResolvedValueOnce({ id: "client-1" })

    await fetchClient("client-1")

    expect(getMock).toHaveBeenCalledWith("/dashboard/people/clients/client-1")
  })

  it("posts walk-in client payload to the correct endpoint", async () => {
    postMock.mockResolvedValueOnce({ id: "walkin-1", isExisting: false })

    await createWalkInClient({
      firstName: "محمد",
      lastName: "السالم",
      phone: "+966501234567",
      emergencyPhone: "+966500000111",
      bloodType: "O_NEG",
    })

    expect(postMock).toHaveBeenCalledWith("/dashboard/people/clients", {
      firstName: "محمد",
      lastName: "السالم",
      phone: "+966501234567",
      emergencyPhone: "+966500000111",
      bloodType: "O_NEG",
    })
  })

  it("rejects a blood type outside the OpenAPI contract", async () => {
    await expect(createWalkInClient({
      firstName: "محمد",
      lastName: "السالم",
      phone: "+966501234567",
      bloodType: "INVALID",
    })).rejects.toThrow("Invalid client blood type")
    expect(postMock).not.toHaveBeenCalled()
  })

  it("patches client updates to the correct endpoint", async () => {
    patchMock.mockResolvedValueOnce({ id: "client-1" })

    await updateClient("client-1", {
      firstName: "أحمد",
      phone: "+966500000222",
      allergies: "Dust",
    })

    expect(patchMock).toHaveBeenCalledWith("/dashboard/people/clients/client-1", {
      firstName: "أحمد",
      phone: "+966500000222",
      allergies: "Dust",
    })
  })

  it("deleteClient calls DELETE /dashboard/people/clients/:id", async () => {
    deleteMock.mockResolvedValueOnce(undefined)
    await deleteClient("client-1")
    expect(deleteMock).toHaveBeenCalledWith("/dashboard/people/clients/client-1")
  })

  it("setClientActive patches /clients/:id/active endpoint", async () => {
    patchMock.mockResolvedValueOnce({ id: "client-1", isActive: true })
    await setClientActive("client-1", { isActive: true })
    expect(patchMock).toHaveBeenCalledWith("/dashboard/people/clients/client-1/active", { isActive: true })
  })

  it("does not mark staff projections lacking email proof as verified", async () => {
    getMock.mockResolvedValueOnce({id:"client-1",firstName:"Sara",lastName:"",email:"sara@example.test"})
    expect((await fetchClient("client-1")).emailVerified).toBe(false)
  })
  it("sends explicit nulls for optional fields cleared in an edit", async () => {
    patchMock.mockResolvedValueOnce({id:"client-1"})
    await updateClient("client-1",{middleName:"",phone:"",allergies:"",emergencyPhone:"",dateOfBirth:""})
    expect(patchMock).toHaveBeenCalledWith("/dashboard/people/clients/client-1",expect.objectContaining({middleName:null,phone:null,allergies:null,emergencyPhone:null,dateOfBirth:null}))
  })

})
