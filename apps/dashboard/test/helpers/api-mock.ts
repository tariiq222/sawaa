import { vi } from "vitest"

export function createApiMocks() {
  const getMock = vi.fn()
  const postMock = vi.fn()
  const putMock = vi.fn()
  const patchMock = vi.fn()
  const deleteMock = vi.fn()

  function mockApi() {
    vi.mock("@/lib/api", () => ({
      api: {
        get: getMock,
        post: postMock,
        put: putMock,
        patch: patchMock,
        delete: deleteMock,
      },
    }))
  }

  return { getMock, postMock, putMock, patchMock, deleteMock, mockApi } as const
}
