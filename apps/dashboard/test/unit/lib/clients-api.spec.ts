import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock, postMock, patchMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  patchMock: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  api: {
    get: getMock,
    post: postMock,
    patch: patchMock,
  },
}))

import {
  createWalkInClient,
  fetchClient,
  fetchClients,
  updateClient,
} from "@/lib/api/clients"

describe("clients api", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fetches client list with pagination and search params", async () => {
    getMock.mockResolvedValueOnce({ items: [], meta: { total: 0 } })

    await fetchClients({ page: 2, perPage: 10, search: "محمد" })

    expect(getMock).toHaveBeenCalledWith("/dashboard/people/clients", {
      page: 2,
      limit: 10,
      search: "محمد",
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

})
