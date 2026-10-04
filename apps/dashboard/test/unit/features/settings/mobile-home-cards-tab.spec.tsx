import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { canDo, refetch, createMutateAsync, updateMutateAsync, reorderMutateAsync, uploadMutateAsync, cards, queryState, pending } = vi.hoisted(() => ({
  canDo: vi.fn(),
  refetch: vi.fn(() => Promise.resolve()),
  createMutateAsync: vi.fn(),
  updateMutateAsync: vi.fn(),
  reorderMutateAsync: vi.fn(),
  uploadMutateAsync: vi.fn(),
  cards: [] as Array<Record<string, unknown>>,
  queryState: { isLoading: false, isError: false, isFetching: false },
  pending: { create: false, update: false, reorder: false, upload: false },
}))

vi.mock("@/components/locale-provider", () => ({ useLocale: () => ({ t: (key: string) => key }) }))
vi.mock("@/components/providers/auth-provider", () => ({ useAuth: () => ({ canDo }) }))
vi.mock("@/hooks/use-mobile-home-cards", () => ({
  useMobileHomeCards: () => ({ ...queryState, data: cards, refetch }),
}))
vi.mock("@/hooks/use-mobile-home-card-mutations", () => ({
  useMobileHomeCardMutations: () => ({
    create: { mutateAsync: createMutateAsync, isPending: pending.create },
    update: { mutateAsync: updateMutateAsync, isPending: pending.update },
    reorder: { mutateAsync: reorderMutateAsync, isPending: pending.reorder },
    uploadImage: { mutateAsync: uploadMutateAsync, isPending: pending.upload },
  }),
}))

import { MobileHomeCardsTab } from "@/components/features/settings/mobile-home-cards-tab"

describe("MobileHomeCardsTab permissions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    cards.splice(0, cards.length)
    queryState.isLoading = false
    queryState.isError = false
    queryState.isFetching = false
    pending.create = false
    pending.update = false
    pending.reorder = false
    pending.upload = false
    refetch.mockImplementation(() => Promise.resolve())
    canDo.mockImplementation((_module: string, action: string) => action === "read")
  })

  it("keeps card management read-only without update Setting permission", () => {
    render(<MobileHomeCardsTab />)
    expect(screen.getByRole("button", { name: "mobileHomeCards.add" })).toBeDisabled()
    expect(screen.getByText("mobileHomeCards.readOnly")).toBeInTheDocument()
    expect(canDo).toHaveBeenCalledWith("setting", "update")
  })

  it("preserves new-card edits after a failed save", async () => {
    canDo.mockReturnValue(true)
    createMutateAsync.mockRejectedValueOnce(new Error("network"))
    render(<MobileHomeCardsTab />)
    fireEvent.click(screen.getByRole("button", { name: "mobileHomeCards.add" }))
    const title = screen.getByLabelText("mobileHomeCards.titleAr")
    fireEvent.change(title, { target: { value: "تعديل محفوظ محلياً" } })
    fireEvent.click(screen.getByRole("button", { name: "mobileHomeCards.save" }))
    await screen.findByText("mobileHomeCards.saveFailed")
    expect(title).toHaveValue("تعديل محفوظ محلياً")
  })

  it("keeps edits after a version conflict and blocks retry until the explicit reload", async () => {
    canDo.mockReturnValue(true)
    cards.push({
      id: "card-1", titleAr: "عنوان قديم", titleEn: null, descriptionAr: null, descriptionEn: null,
      imageFileId: null, imageUrl: null, imageAltAr: null, imageAltEn: null, destination: null,
      sortOrder: 0, isPublished: false, createdAt: "2026-09-27T08:00:00.000Z", updatedAt: "2026-09-27T08:00:00.000Z",
    })
    updateMutateAsync.mockRejectedValueOnce({ status: 409 })
    const view = render(<MobileHomeCardsTab />)
    fireEvent.click(screen.getByRole("button", { name: /عنوان قديم/ }))
    const title = screen.getByLabelText("mobileHomeCards.titleAr")
    fireEvent.change(title, { target: { value: "تعديلي" } })
    cards[0].updatedAt = "2026-09-27T08:05:00.000Z"
    cards[0].titleAr = "تغيير من موظف آخر"
    view.rerender(<MobileHomeCardsTab />)
    fireEvent.click(screen.getByRole("button", { name: "mobileHomeCards.save" }))
    await screen.findByText("mobileHomeCards.conflict")
    expect(title).toHaveValue("تعديلي")
    expect(updateMutateAsync).toHaveBeenCalledWith(expect.objectContaining({
      expectedUpdatedAt: "2026-09-27T08:00:00.000Z",
    }))
    expect(screen.getByRole("button", { name: "mobileHomeCards.save" })).toBeDisabled()
    fireEvent.click(screen.getByRole("button", { name: "mobileHomeCards.reloadLatest" }))
    await waitFor(() => expect(title).toHaveValue("تغيير من موظف آخر"))
  })

  it("keeps a dirty editor mounted when a background refetch fails with cached cards", async () => {
    canDo.mockReturnValue(true)
    cards.push({
      id: "card-1", titleAr: "عنوان", titleEn: null, descriptionAr: null, descriptionEn: null,
      imageFileId: null, imageUrl: null, imageAltAr: null, imageAltEn: null, destination: null,
      sortOrder: 0, isPublished: false, createdAt: "2026-09-27T08:00:00.000Z", updatedAt: "2026-09-27T08:00:00.000Z",
    })
    const view = render(<MobileHomeCardsTab />)
    fireEvent.click(screen.getByRole("button", { name: /عنوان/ }))
    const title = screen.getByLabelText("mobileHomeCards.titleAr")
    fireEvent.change(title, { target: { value: "مسودة غير محفوظة" } })
    refetch.mockImplementationOnce(() => {
      queryState.isError = true
      return Promise.resolve()
    })
    await refetch()
    view.rerender(<MobileHomeCardsTab />)
    expect(screen.getByText("mobileHomeCards.loadFailed")).toBeInTheDocument()
    expect(title).toHaveValue("مسودة غير محفوظة")
    expect(screen.getByRole("button", { name: "mobileHomeCards.save" })).toBeInTheDocument()
  })

  it("locks card selection, adding, and reordering while a save is pending", () => {
    canDo.mockReturnValue(true)
    cards.push(
      { id: "card-1", titleAr: "الأول", titleEn: null, descriptionAr: null, descriptionEn: null, imageFileId: null, imageUrl: null, imageAltAr: null, imageAltEn: null, destination: null, sortOrder: 0, isPublished: false, createdAt: "2026-09-27T08:00:00.000Z", updatedAt: "2026-09-27T08:00:00.000Z" },
      { id: "card-2", titleAr: "الثاني", titleEn: null, descriptionAr: null, descriptionEn: null, imageFileId: null, imageUrl: null, imageAltAr: null, imageAltEn: null, destination: null, sortOrder: 1, isPublished: false, createdAt: "2026-09-27T08:00:00.000Z", updatedAt: "2026-09-27T08:00:00.000Z" },
    )
    const view = render(<MobileHomeCardsTab />)
    fireEvent.click(screen.getByRole("button", { name: /الأول/ }))
    pending.update = true
    view.rerender(<MobileHomeCardsTab />)
    expect(screen.getByRole("button", { name: "mobileHomeCards.add" })).toBeDisabled()
    expect(screen.getByRole("button", { name: /الثاني/ })).toBeDisabled()
    expect(screen.getAllByRole("button", { name: "mobileHomeCards.moveDown" })).toHaveLength(2)
    for (const button of screen.getAllByRole("button", { name: "mobileHomeCards.moveDown" })) expect(button).toBeDisabled()
  })
})
