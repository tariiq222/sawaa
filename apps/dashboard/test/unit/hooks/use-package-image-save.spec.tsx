import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  upload: vi.fn(),
  attach: vi.fn(),
  cleanup: vi.fn(),
}))
vi.mock("sonner", () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess, warning: vi.fn() },
}))
vi.mock("@/lib/api/packages", () => ({
  uploadPackageMedia: mocks.upload,
  attachPackageImage: mocks.attach,
  deletePackageMedia: mocks.cleanup,
}))
vi.mock("@/lib/mutation-helpers", () => ({ showApiError: mocks.toastError }))

import { usePackageImageSave } from "@/hooks/use-package-image-save"
import { ApiError } from "@/lib/api"

const t = (key: string) => key
const file = new File(["cover"], "cover.png", { type: "image/png" })

function renderFlow() {
  return renderHook(() => usePackageImageSave(t))
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.upload.mockResolvedValue({ id: "media-1", storageKey: "packages/pkg-1/cover.png" })
  mocks.attach.mockResolvedValue({ id: "pkg-1" })
})

/**
 * The shared flow behind both package forms. `PackageFormPage` always renders
 * `GroupedPackageFormPage` for create and for GROUPED_V2 edits, so this spec is
 * the legacy editor's equivalent coverage of the same code path.
 */
describe("usePackageImageSave (T11-F1/T11-F2)", () => {
  it("attaches the storage key after saving and only then finishes", async () => {
    const save = vi.fn().mockResolvedValue("pkg-1")
    const finish = vi.fn()
    const { result } = renderFlow()

    await act(async () => {
      await result.current.saveWithImage({ save, finish, file })
    })

    expect(save).toHaveBeenCalledTimes(1)
    expect(mocks.upload).toHaveBeenCalledTimes(1)
    expect(mocks.attach).toHaveBeenCalledWith("pkg-1", "packages/pkg-1/cover.png")
    expect(finish).toHaveBeenCalledTimes(1)
    expect(mocks.toastError).not.toHaveBeenCalled()
  })

  it("runs finish only after the image step — never before it", async () => {
    const order: string[] = []
    const { result } = renderFlow()
    mocks.upload.mockImplementationOnce(async () => {
      order.push("upload")
      return { id: "media-1", storageKey: "k" }
    })

    await act(async () => {
      await result.current.saveWithImage({
        save: async () => {
          order.push("save")
          return "pkg-1"
        },
        finish: () => order.push("finish"),
        file,
      })
    })

    expect(order).toEqual(["save", "upload", "finish"])
  })

  it("shows an error, keeps the pending file retryable, and skips attach + finish when the upload fails", async () => {
    mocks.upload.mockRejectedValueOnce(new Error("Upload failed"))
    const finish = vi.fn()
    const { result } = renderFlow()

    let outcome: boolean | undefined
    await act(async () => {
      outcome = await result.current.saveWithImage({
        save: async () => "pkg-1",
        finish,
        file,
      })
    })

    expect(outcome).toBe(false)
    expect(mocks.toastError).toHaveBeenCalledWith("packages.errors.imageUpload")
    expect(mocks.attach).not.toHaveBeenCalled()
    expect(finish).not.toHaveBeenCalled()
    expect(mocks.cleanup).not.toHaveBeenCalled()
    expect(result.current.failedUpload).toContain("cover.png")

    // Retrying with the same staged file uploads again and then succeeds.
    mocks.upload.mockResolvedValue({ id: "media-2", storageKey: "packages/pkg-1/cover.png" })
    await act(async () => {
      outcome = await result.current.saveWithImage({
        save: async () => "pkg-1",
        finish,
        file,
      })
    })
    expect(outcome).toBe(true)
    expect(finish).toHaveBeenCalledTimes(1)
    expect(result.current.failedUpload).toBeNull()
  })

  it("removes the orphaned upload and blocks finish when the attach PATCH fails", async () => {
    mocks.attach.mockRejectedValueOnce(new Error("attach failed"))
    mocks.cleanup.mockRejectedValueOnce(new Error("cleanup failed"))
    const finish = vi.fn()
    const { result } = renderFlow()

    await act(async () => {
      await result.current.saveWithImage({
        save: async () => "pkg-1",
        finish,
        file,
      })
    })

    expect(mocks.cleanup).toHaveBeenCalledWith("media-1")
    expect(mocks.toastError).toHaveBeenCalledWith("packages.errors.imageAttach")
    expect(finish).not.toHaveBeenCalled()
    expect(result.current.failedUpload).toContain("cover.png")
  })

  it("rethrows a save-stage failure to the form owner instead of a generic toast", async () => {
    const saveError = new ApiError(400, "Package owner was not found or is inactive", {})
    const finish = vi.fn()
    const { result } = renderFlow()

    let thrown: unknown
    await act(async () => {
      try {
        await result.current.saveWithImage({
          save: async () => {
            throw saveError
          },
          finish,
          file,
        })
      } catch (err) {
        thrown = err
      }
    })

    expect(thrown).toBe(saveError)
    expect(mocks.toastError).not.toHaveBeenCalled()
    expect(mocks.upload).not.toHaveBeenCalled()
    expect(mocks.attach).not.toHaveBeenCalled()
    expect(finish).not.toHaveBeenCalled()
  })

  it("leaves a saved package alone when no image is staged", async () => {
    const finish = vi.fn()
    const { result } = renderFlow()

    await act(async () => {
      await result.current.saveWithImage({
        save: async () => "pkg-1",
        finish,
        file: null,
      })
    })

    expect(mocks.upload).not.toHaveBeenCalled()
    expect(mocks.attach).not.toHaveBeenCalled()
    expect(finish).toHaveBeenCalledTimes(1)
  })
})

/**
 * Leaving the screen (t15). The in-flight upload/attach is deliberately not
 * aborted — cancelling it mid-flight would orphan media — but every late
 * response must stay invisible: no toast, no success toast, no navigation.
 */
describe("usePackageImageSave screen-exit guard (t15)", () => {
  it("ignores a late upload failure after unmount", async () => {
    let rejectUpload: (reason: Error) => void = () => {}
    mocks.upload.mockImplementationOnce(
      () => new Promise<never>((_resolve, reject) => { rejectUpload = reject }),
    )
    const finish = vi.fn()
    const { result, unmount } = renderFlow()

    // Started outside act: a pending request keeps no React update in flight.
    const pending = result.current.saveWithImage({ save: async () => "pkg-1", finish, file })
    await vi.waitFor(() => expect(mocks.upload).toHaveBeenCalledTimes(1))
    unmount()
    rejectUpload(new Error("Upload failed"))
    await expect(pending).resolves.toBe(false)

    expect(mocks.toastError).not.toHaveBeenCalled()
    expect(mocks.toastSuccess).not.toHaveBeenCalled()
    expect(finish).not.toHaveBeenCalled()
    expect(mocks.attach).not.toHaveBeenCalled()
  })

  it("ignores a late attach failure after unmount", async () => {
    let rejectAttach: (reason: Error) => void = () => {}
    mocks.attach.mockImplementationOnce(
      () => new Promise<never>((_resolve, reject) => { rejectAttach = reject }),
    )
    const finish = vi.fn()
    const { result, unmount } = renderFlow()

    const pending = result.current.saveWithImage({ save: async () => "pkg-1", finish, file })
    await vi.waitFor(() => expect(mocks.attach).toHaveBeenCalledTimes(1))
    unmount()
    rejectAttach(new Error("attach failed"))
    await expect(pending).resolves.toBe(false)

    // The uploaded media is still cleaned up — that work is not presentation.
    expect(mocks.cleanup).toHaveBeenCalledWith("media-1")
    expect(mocks.toastError).not.toHaveBeenCalled()
    expect(mocks.toastSuccess).not.toHaveBeenCalled()
    expect(finish).not.toHaveBeenCalled()
  })

  it("never runs finish (success toast + navigation) for a late success after unmount", async () => {
    let resolveUpload: (value: { id: string; storageKey: string }) => void = () => {}
    mocks.upload.mockImplementationOnce(
      () => new Promise<{ id: string; storageKey: string }>((resolve) => { resolveUpload = resolve }),
    )
    const finish = vi.fn()
    const { result, unmount } = renderFlow()

    const pending = result.current.saveWithImage({ save: async () => "pkg-1", finish, file })
    await vi.waitFor(() => expect(mocks.upload).toHaveBeenCalledTimes(1))
    unmount()
    resolveUpload({ id: "media-1", storageKey: "packages/pkg-1/cover.png" })
    await expect(pending).resolves.toBe(true)

    // The image itself was still attached — only the UI reaction is guarded.
    expect(mocks.attach).toHaveBeenCalledWith("pkg-1", "packages/pkg-1/cover.png")
    expect(finish).not.toHaveBeenCalled()
    expect(mocks.toastSuccess).not.toHaveBeenCalled()
    expect(mocks.toastError).not.toHaveBeenCalled()
  })

  it("answers the caller's departure guard while mounted and after unmount", async () => {
    let rejectUpload: (reason: Error) => void = () => {}
    mocks.upload.mockImplementationOnce(
      () => new Promise<never>((_resolve, reject) => { rejectUpload = reject }),
    )
    const { result, unmount } = renderFlow()

    expect(result.current.canNavigate()).toBe(true)

    const pending = result.current.saveWithImage({ save: async () => "pkg-1", finish: vi.fn(), file })
    await vi.waitFor(() => expect(mocks.upload).toHaveBeenCalledTimes(1))
    unmount()
    // The caller reads this only after the late response resolves, so the
    // guard must already report "left" by then.
    expect(result.current.canNavigate()).toBe(false)
    rejectUpload(new Error("Upload failed"))
    await expect(pending).resolves.toBe(false)
    expect(result.current.canNavigate()).toBe(false)
  })
})
