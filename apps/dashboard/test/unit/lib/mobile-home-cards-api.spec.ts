import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock, postMock, patchMock, putMock, postFormMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  patchMock: vi.fn(),
  putMock: vi.fn(),
  postFormMock: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  api: {
    get: getMock,
    post: postMock,
    patch: patchMock,
    put: putMock,
    postForm: postFormMock,
  },
}))

import {
  createMobileHomeCard,
  reorderMobileHomeCards,
  updateMobileHomeCard,
  uploadMobileHomeCardImage,
} from "@/lib/api/mobile-home-cards"

describe("mobile home cards api", () => {
  beforeEach(() => vi.clearAllMocks())

  it("creates cards with the supplied bilingual content", async () => {
    const payload = { titleAr: "عنوان", titleEn: "Title", imageFileId: null }
    postMock.mockResolvedValueOnce({ id: "card-1", ...payload })
    await createMobileHomeCard(payload as Parameters<typeof createMobileHomeCard>[0])
    expect(postMock).toHaveBeenCalledWith("/dashboard/mobile-home-cards", payload)
  })

  it("propagates the expected version and explicit null when clearing an image", async () => {
    const payload = { imageFileId: null, expectedUpdatedAt: "2026-09-27T08:00:00.000Z" }
    patchMock.mockResolvedValueOnce({ id: "card-1" })
    await updateMobileHomeCard("card-1", payload)
    expect(patchMock).toHaveBeenCalledWith("/dashboard/mobile-home-cards/card-1", payload)
  })

  it("sends the complete swapped order with each card's version", async () => {
    const items = [
      { id: "card-2", expectedUpdatedAt: "2026-09-27T08:02:00.000Z" },
      { id: "card-1", expectedUpdatedAt: "2026-09-27T08:01:00.000Z" },
    ]
    putMock.mockResolvedValueOnce([])
    await reorderMobileHomeCards(items)
    expect(putMock).toHaveBeenCalledWith("/dashboard/mobile-home-cards/reorder", { items })
  })

  it("uploads the image to the existing media API with public visibility", async () => {
    const file = new File(["image"], "card.png", { type: "image/png" })
    postFormMock.mockResolvedValueOnce({ id: "file-1" })
    await uploadMobileHomeCardImage(file)
    const form = postFormMock.mock.calls[0][1] as FormData
    expect(postFormMock.mock.calls[0][0]).toBe("/dashboard/media/upload")
    expect(form.get("file")).toBe(file)
    expect(form.get("visibility")).toBe("PUBLIC")
  })
})
