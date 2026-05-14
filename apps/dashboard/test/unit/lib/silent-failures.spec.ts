/**
 * Silent-failure logging — unit tests
 *
 * The 3 spots in lib/api/{chatbot-kb,services}.ts that bypass the shared
 * api client (because they need FormData / presigned URLs) used to swallow
 * the failure body. They now emit a structured `console.error` so failures
 * surface in DevTools + Sentry breadcrumbs.
 *
 * These tests guard the regression — if someone removes the console.error
 * the spy below stops firing.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api")
  return {
    ...actual,
    getAccessToken: vi.fn(() => "tok"),
  }
})

describe("silent-failure logging", () => {
  let fetchMock: ReturnType<typeof vi.fn>
  let errorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    errorSpy.mockRestore()
  })

  it("logs uploadKnowledgeFile failures with status + body", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 413,
      statusText: "Payload Too Large",
      json: () => Promise.resolve({ message: "File too big" }),
    })
    const { uploadKnowledgeFile } = await import("@/lib/api/chatbot-kb")
    await expect(uploadKnowledgeFile(new File(["x"], "a.pdf"))).rejects.toThrow()
    expect(errorSpy).toHaveBeenCalledWith(
      "[chatbot-kb] uploadKnowledgeFile failed",
      expect.objectContaining({ status: 413 }),
    )
  })

  it("logs uploadServiceImage upload-step failures with status + body", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: () => Promise.resolve({ message: "boom" }),
    })
    const { uploadServiceImage } = await import("@/lib/api/services")
    await expect(
      uploadServiceImage("svc-1", new File(["x"], "img.png")),
    ).rejects.toThrow()
    expect(errorSpy).toHaveBeenCalledWith(
      "[services] uploadServiceImage upload failed",
      expect.objectContaining({ status: 500 }),
    )
  })

  it("logs uploadServiceImage presigned-url failures with status + mediaId", async () => {
    // Step 1 succeeds — returns a media id
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ id: "media-9", storageKey: "k" }),
    })
    // Step 2 (presigned URL) fails
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: "Not Found",
      json: () => Promise.resolve({ message: "missing" }),
    })
    const { uploadServiceImage } = await import("@/lib/api/services")
    await expect(
      uploadServiceImage("svc-1", new File(["x"], "img.png")),
    ).rejects.toThrow()
    expect(errorSpy).toHaveBeenCalledWith(
      "[services] uploadServiceImage presigned-url failed",
      expect.objectContaining({ status: 404, mediaId: "media-9" }),
    )
  })
})
