import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock, postMock, postFormMock, patchMock, deleteMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  postFormMock: vi.fn(),
  patchMock: vi.fn(),
  deleteMock: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  api: {
    get: getMock,
    post: postMock,
    postForm: postFormMock,
    patch: patchMock,
    delete: deleteMock,
  },
}))

import {
  createCategory,
  deleteCategory,
  fetchCategories,
  updateCategory,
  uploadCategoryImage,
} from "@/lib/api/services"

describe("category API boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("serializes numeric pagination, false filters, and encoded query values through openApi", async () => {
    const response = {
      items: [],
      meta: {
        total: 0,
        page: 2,
        limit: 50,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: true,
      },
    }
    getMock.mockResolvedValueOnce(response)

    await expect(fetchCategories({
      page: 2,
      limit: 50,
      search: "family care",
      isActive: false,
      departmentId: "department/one",
    })).resolves.toEqual(response)

    expect(getMock).toHaveBeenCalledWith(
      "/dashboard/organization/categories?page=2&limit=50&search=family+care&isActive=false&departmentId=department%2Fone",
    )
  })

  it("omits undefined category filters while retaining an explicit false value", async () => {
    getMock.mockResolvedValueOnce({ items: [], meta: {} })

    await fetchCategories({ isActive: false })

    expect(getMock).toHaveBeenCalledWith(
      "/dashboard/organization/categories?isActive=false",
    )
  })

  it("posts the complete create payload, including a null departmentId", async () => {
    const payload = {
      nameAr: "الإرشاد الأسري",
      nameEn: "Family Guidance",
      departmentId: null,
      bookingMode: "SERVICES" as const,
      imageUrl: null,
    }
    const response = { id: "cat-1", ...payload }
    postMock.mockResolvedValueOnce(response)

    await expect(createCategory(payload)).resolves.toEqual(response)
    expect(postMock).toHaveBeenCalledWith(
      "/dashboard/organization/categories",
      payload,
    )
  })

  it("patches an encoded category path and preserves a null departmentId", async () => {
    const payload = { nameAr: "تحديث", departmentId: null }
    const response = { id: "cat/one", ...payload }
    patchMock.mockResolvedValueOnce(response)

    await expect(updateCategory("cat/one", payload)).resolves.toEqual(response)
    expect(patchMock).toHaveBeenCalledWith(
      "/dashboard/organization/categories/cat%2Fone",
      payload,
    )
  })

  it("returns void after deleting a category while encoding its path", async () => {
    deleteMock.mockResolvedValueOnce({ id: "cat/one" })

    await expect(deleteCategory("cat/one")).resolves.toBeUndefined()
    expect(deleteMock).toHaveBeenCalledWith(
      "/dashboard/organization/categories/cat%2Fone",
    )
  })

  it("keeps media upload transport separate and persists the returned storage key via openApi", async () => {
    const file = new File(["image"], "category.png", { type: "image/png" })
    postFormMock.mockResolvedValueOnce({ id: "media-1", storageKey: "categories/cat-1.png" })
    patchMock.mockResolvedValueOnce({ id: "cat-1", imageUrl: "categories/cat-1.png" })

    await uploadCategoryImage("cat/one", file)

    expect(postFormMock).toHaveBeenCalledWith(
      "/dashboard/media/upload",
      expect.any(FormData),
    )
    expect(patchMock).toHaveBeenCalledWith(
      "/dashboard/organization/categories/cat%2Fone",
      { imageUrl: "categories/cat-1.png" },
    )
  })

  it("propagates transport errors from category operations", async () => {
    const error = new Error("category request failed")
    getMock.mockRejectedValueOnce(error)

    await expect(fetchCategories()).rejects.toBe(error)
  })
})
