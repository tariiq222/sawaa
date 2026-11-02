import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { RenderResult } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useEffect, useState } from "react"
import type { UseFormReturn } from "react-hook-form"
import type { GroupedPackageFormData } from "@/lib/schemas/package-groups.schema"

const mocks = vi.hoisted(() => ({
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  push: vi.fn(),
  focusError: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  upload: vi.fn(),
  attach: vi.fn(),
  cleanup: vi.fn(),
  pendingFile: { current: null as File | null },
}))
vi.mock("sonner", () => ({
  toast: {
    error: mocks.toastError,
    success: mocks.toastSuccess,
    warning: vi.fn(),
  },
}))
vi.mock("@/lib/package-validation", () => ({
  collectPackageErrorPaths: () => [],
  focusPackageError: mocks.focusError,
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }))
vi.mock("@/hooks/use-packages", () => ({
  usePackage: () => ({ data: undefined, isLoading: false }),
  usePackageMutations: () => ({
    createMut: { isPending: false, mutateAsync: mocks.create },
    updateMut: { isPending: false, mutateAsync: mocks.update },
  }),
}))
vi.mock("@/lib/api/packages", () => ({
  uploadPackageMedia: mocks.upload,
  attachPackageImage: mocks.attach,
  deletePackageMedia: mocks.cleanup,
}))
vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({ locale: "en", dir: "ltr", t: (key: string) => key }),
}))
vi.mock("@/components/features/list-page-shell", () => ({
  ListPageShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))
vi.mock("@/components/features/page-header", () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}))
vi.mock("@/components/features/breadcrumbs", () => ({ Breadcrumbs: () => <div /> }))
vi.mock("@/components/features/packages/grouped-package-details", () => ({
  GroupedPackageDetails: ({
    form,
    onImageSelect,
    onImageClear,
  }: {
    form: UseFormReturn<GroupedPackageFormData>
    onImageSelect: (file: File) => void
    onImageClear?: () => void
  }) => (
    <>
      <input id="nameAr" {...form.register("nameAr")} />
      <input id="isActive" type="checkbox" {...form.register("isActive")} />
      <input id="isPublic" type="checkbox" {...form.register("isPublic")} />
      <input id="sortOrder" type="number" {...form.register("sortOrder")} />
      {/* Mirrors the real details step: a picked file sets a blob URL; a clear
          or an icon pick nulls it and drops the staged file in the parent. */}
      <button
        type="button"
        onClick={() => {
          form.setValue("imageUrl", "blob:cover.png")
          form.setValue("iconName", null)
          form.setValue("iconBgColor", null)
          onImageSelect(new File(["cover"], "cover.png", { type: "image/png" }))
        }}
      >
        pick-image
      </button>
      <button
        type="button"
        onClick={() => {
          form.setValue("iconName", null)
          form.setValue("iconBgColor", null)
          form.setValue("imageUrl", null)
          onImageClear?.()
        }}
      >
        clear-image
      </button>
      <button
        type="button"
        onClick={() => {
          form.setValue("iconName", "Clock01Icon")
          form.setValue("iconBgColor", "#123456")
          form.setValue("imageUrl", null)
          onImageClear?.()
        }}
      >
        choose-icon
      </button>
    </>
  ),
}))
vi.mock("@/components/features/packages/grouped-package-groups", () => ({
  GroupedPackageGroups: ({ form }: { form: UseFormReturn<GroupedPackageFormData> }) => (
    <section data-package-section="groups">
      <select data-testid="groups.0.serviceId" {...form.register("groups.0.serviceId")}>
        <option value="" />
        <option value="11111111-1111-4111-8111-111111111111" />
      </select>
      <select data-testid="groups.0.employeeId" {...form.register("groups.0.employeeId")}>
        <option value="" />
        <option value="22222222-2222-4222-8222-222222222222" />
      </select>
      <select
        data-testid="groups.0.sessions.0.durationOptionId"
        {...form.register("groups.0.sessions.0.durationOptionId")}
      >
        <option value="" />
        <option value="33333333-3333-4333-8333-333333333333" />
      </select>
    </section>
  ),
}))
vi.mock("@/components/features/packages/grouped-package-pricing", () => ({
  GroupedPackagePricing: () => <div />,
}))
vi.mock("@/components/features/packages/grouped-package-review", () => ({
  GroupedPackageReview: () => <div />,
}))

import { GroupedPackageFormPage } from "@/components/features/packages/grouped-package-form-page"
import { ApiError } from "@/lib/api"

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <GroupedPackageFormPage mode="create" />
    </QueryClientProvider>,
  )
}

function renderCreateWithEditNavigation() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <CreateRouteWithEditNavigation />
    </QueryClientProvider>,
  )
}

/**
 * Models the App Router around the create route (t17).
 *
 * t15 sends a create form whose image step failed to the edit screen, but the
 * create route is not thrown away: Next keeps the visited route in its client
 * router cache and hides it rather than discarding its state, so going back
 * restores the very same editor state — `createdId` included. This harness
 * keeps the create route mounted-hidden while the edit route is shown and
 * exposes the "back" action, so the resubmit below runs against the state the
 * browser restores, not against a freshly mounted form.
 */
function CreateRouteWithEditNavigation() {
  const [route, setRoute] = useState<"create" | "edit">("create")
  useEffect(() => {
    mocks.push.mockImplementation((href: string) => {
      if (typeof href === "string" && href.endsWith("/edit")) setRoute("edit")
    })
  }, [])
  return (
    <>
      <div hidden={route !== "create"} data-testid="create-route">
        <GroupedPackageFormPage mode="create" />
      </div>
      {route === "edit" && (
        <div data-testid="edit-route">
          <button type="button" onClick={() => setRoute("create")}>
            back-to-create
          </button>
        </div>
      )}
    </>
  )
}

/**
 * Submits the grouped form past all four steps with a staged image.
 *
 * `onDetails` runs while the details step is still mounted, so a test can
 * clear or replace the avatar after picking the file.
 */
async function submitWithImage(
  opts: {
    onDetails?: () => void
    skipSubmit?: boolean
    render?: () => RenderResult
    onSubmit?: (view: { unmount: () => void }) => void
  } = {},
) {
  const {
    onDetails,
    skipSubmit,
    render: renderUnderTest = renderPage,
    onSubmit,
  } = opts
  const view = renderUnderTest()
  const form = screen.getByRole("textbox").closest("form") as HTMLFormElement
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "باقة تجريبية" } })
  fireEvent.click(screen.getByRole("button", { name: "pick-image" }))
  onDetails?.()
  // Steps 1 → 4: details, then the group row the shared schema requires.
  fireEvent.click(screen.getByRole("button", { name: "packages.steps.next" }))
  await waitFor(() => expect(screen.getByTestId("groups.0.serviceId")).toBeTruthy())
  fireEvent.change(screen.getByTestId("groups.0.serviceId"), {
    target: { value: "11111111-1111-4111-8111-111111111111" },
  })
  fireEvent.change(screen.getByTestId("groups.0.employeeId"), {
    target: { value: "22222222-2222-4222-8222-222222222222" },
  })
  // React must commit the typed values before nextStep validates step 2.
  await new Promise((resolve) => setTimeout(resolve, 50))
  fireEvent.change(screen.getByTestId("groups.0.sessions.0.durationOptionId"), {
    target: { value: "33333333-3333-4333-8333-333333333333" },
  })
  fireEvent.click(screen.getByRole("button", { name: "packages.steps.next" }))
  await new Promise((resolve) => setTimeout(resolve, 50))
  fireEvent.click(screen.getByRole("button", { name: "packages.steps.next" }))
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: "packages.create.submit" })).toBeTruthy(),
  )
  if (!skipSubmit) {
    fireEvent.submit(form)
    onSubmit?.({ unmount: view.unmount })
  }
  return form
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.create.mockResolvedValue({ id: "pkg-1" })
  mocks.update.mockResolvedValue({ id: "pkg-1" })
  mocks.upload.mockResolvedValue({ id: "media-1", storageKey: "packages/pkg-1/cover.png" })
  mocks.attach.mockResolvedValue({ id: "pkg-1" })
})

describe("GroupedPackageFormPage failed image after a successful create (t15)", () => {
  it("navigates to the created package's edit screen instead of staying on create", async () => {
    mocks.upload.mockRejectedValueOnce(new Error("Upload failed"))
    const form = await submitWithImage()

    await waitFor(() =>
      expect(mocks.toastError.mock.calls.map(String).join("|")).toContain("imageUpload"),
    )
    expect(mocks.create).toHaveBeenCalledTimes(1)
    expect(mocks.update).not.toHaveBeenCalled()
    // One target only: the real edit route with the id that was just created.
    expect(mocks.push).toHaveBeenCalledTimes(1)
    expect(mocks.push).toHaveBeenCalledWith("/packages/pkg-1/edit")
    // The failure is visible and no success is ever announced.
    expect(mocks.toastSuccess).not.toHaveBeenCalled()
    expect(mocks.attach).not.toHaveBeenCalled()
    // The stale create form is gone, so a second submit cannot create a copy.
    fireEvent.submit(form)
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(mocks.create).toHaveBeenCalledTimes(1)
  })

  it("navigates to the edit screen and drops the orphaned upload when attach fails", async () => {
    mocks.attach.mockRejectedValueOnce(new Error("attach failed"))
    await submitWithImage()

    await waitFor(() =>
      expect(mocks.toastError.mock.calls.map(String).join("|")).toContain("imageAttach"),
    )
    expect(mocks.cleanup).toHaveBeenCalledWith("media-1")
    expect(mocks.push).toHaveBeenCalledTimes(1)
    expect(mocks.push).toHaveBeenCalledWith("/packages/pkg-1/edit")
    expect(mocks.toastSuccess).not.toHaveBeenCalled()
  })

  it("never navigates to the edit screen when the screen is left before the upload fails", async () => {
    let rejectUpload: (reason: Error) => void = () => {}
    mocks.upload.mockImplementationOnce(
      () => new Promise<never>((_resolve, reject) => { rejectUpload = reject }),
    )
    const view = { leave: null as (() => void) | null }

    await submitWithImage({ onSubmit: ({ unmount }) => { view.leave = unmount } })

    // Leave the screen only once the save resolved and the upload is in
    // flight — otherwise this would pass by never starting the request.
    await waitFor(() => expect(mocks.upload).toHaveBeenCalledTimes(1))
    expect(mocks.push).not.toHaveBeenCalled()
    view.leave?.()
    // The late failure resolves after the unmount: no toast at all may show.
    rejectUpload(new Error("Upload failed"))
    await act(async () => {})

    // The in-flight attach still finished server-side and the package exists,
    // but a removed form must never push the user to another screen.
    expect(mocks.create).toHaveBeenCalledTimes(1)
    expect(mocks.push).not.toHaveBeenCalled()
    expect(mocks.toastError).not.toHaveBeenCalled()
    expect(mocks.toastSuccess).not.toHaveBeenCalled()
  })

  it("updates the created package instead of creating a copy when the form is resubmitted", async () => {
    mocks.upload.mockRejectedValueOnce(new Error("Upload failed"))
    const form = await submitWithImage()
    await waitFor(() => expect(mocks.push).toHaveBeenCalledTimes(1))
    expect(mocks.push).toHaveBeenCalledWith("/packages/pkg-1/edit")

    // The lock was released and the same mounted form is submitted again: the
    // known created id is updated, never created twice.
    mocks.upload.mockRejectedValueOnce(new Error("Upload failed again"))
    fireEvent.submit(form)
    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1))
    expect(mocks.update.mock.calls[0][0].id).toBe("pkg-1")
    expect(mocks.create).toHaveBeenCalledTimes(1)
    // A retried create owns no fresh id of its own: the mounted state keeps
    // pointing at the package created by the first attempt.
    expect(mocks.push.mock.calls.filter((call) => call[0] === "/packages/pkg-1/edit")).toHaveLength(2)
    expect(mocks.push).not.toHaveBeenCalledWith("/packages")
    expect(mocks.toastSuccess).not.toHaveBeenCalled()
  })
})

describe("GroupedPackageFormPage back to a restored create form (t17)", () => {
  it("updates the package created by the first attempt instead of creating a second one", async () => {
    mocks.upload.mockRejectedValueOnce(new Error("Upload failed"))
    const form = await submitWithImage({ render: renderCreateWithEditNavigation })

    // First attempt: created once, image failed, edit screen shown.
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/packages/pkg-1/edit"))
    expect(mocks.create).toHaveBeenCalledTimes(1)
    expect(mocks.update).not.toHaveBeenCalled()
    expect(screen.getByTestId("edit-route")).toBeTruthy()

    // Back: the create route comes back with the editor state it left with,
    // so `createdId` is still known to the form.
    fireEvent.click(screen.getByRole("button", { name: "back-to-create" }))
    expect(screen.queryByTestId("edit-route")).toBeNull()

    // Second attempt (the upload now succeeds): the known package is updated,
    // never created a second time.
    fireEvent.submit(form)
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/packages"))
    expect(mocks.update).toHaveBeenCalledTimes(1)
    expect(mocks.update.mock.calls[0][0].id).toBe("pkg-1")
    expect(mocks.create).toHaveBeenCalledTimes(1)
    expect(mocks.attach).toHaveBeenCalledWith("pkg-1", "packages/pkg-1/cover.png")
    expect(mocks.toastSuccess).toHaveBeenCalledWith("packages.create.success")
    expect(mocks.toastError).toHaveBeenCalledTimes(1)
  })
})

describe("GroupedPackageFormPage save failure (t10 regression)", () => {
  it("shows the translated known API message, not the raw text, and returns to the owning step", async () => {
    // Known backend message from the package error map (owner invalid → step 1).
    mocks.create.mockRejectedValueOnce(
      new ApiError(400, "Package owner was not found or is inactive", {}),
    )
    renderPage()
    const form = screen.getByRole("textbox").closest("form") as HTMLFormElement
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "باقة تجريبية" } })
    fireEvent.click(screen.getByRole("button", { name: "pick-image" }))
    fireEvent.click(screen.getByRole("button", { name: "packages.steps.next" }))
    await waitFor(() => expect(screen.getByTestId("groups.0.serviceId")).toBeTruthy())
    fireEvent.change(screen.getByTestId("groups.0.serviceId"), {
      target: { value: "11111111-1111-4111-8111-111111111111" },
    })
    fireEvent.change(screen.getByTestId("groups.0.employeeId"), {
      target: { value: "22222222-2222-4222-8222-222222222222" },
    })
    await new Promise((resolve) => setTimeout(resolve, 50))
    fireEvent.change(screen.getByTestId("groups.0.sessions.0.durationOptionId"), {
      target: { value: "33333333-3333-4333-8333-333333333333" },
    })
    fireEvent.click(screen.getByRole("button", { name: "packages.steps.next" }))
    await new Promise((resolve) => setTimeout(resolve, 50))
    fireEvent.click(screen.getByRole("button", { name: "packages.steps.next" }))
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "packages.create.submit" })).toBeTruthy(),
    )
    fireEvent.submit(form)

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith("packages.errors.ownerInvalid"),
    )
    // The raw English API text never reaches the user.
    expect(mocks.toastError.mock.calls.map(String).join("|")).not.toContain(
      "Package owner was not found",
    )
    expect(mocks.toastSuccess).not.toHaveBeenCalled()
    expect(mocks.push).not.toHaveBeenCalled()
    expect(mocks.upload).not.toHaveBeenCalled()
    // Step recovers to the details step that owns the package owner field.
    expect(
      screen.getAllByLabelText("packages.steps.label")[0].querySelector('[aria-current="step"]'),
    ).toHaveTextContent("packages.grouped.details.title")
  })
})

describe("GroupedPackageFormPage navigation validation", () => {
  it("advances past valid details even while later group fields are empty", () => {
    renderPage()
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Valid package" } })
    fireEvent.click(screen.getByRole("button", { name: "packages.steps.next" }))
    expect(screen.getAllByLabelText("packages.steps.label")[0].querySelector('[aria-current="step"]')).toHaveTextContent(
      "packages.grouped.steps.groups",
    )
  })

  it("focuses the first invalid group control on the groups step", async () => {
    renderPage()
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Valid package" } })
    fireEvent.click(screen.getByRole("button", { name: "packages.steps.next" }))
    fireEvent.click(screen.getByRole("button", { name: "packages.steps.next" }))
    await waitFor(() => expect(mocks.focusError).toHaveBeenCalledWith("groups.0.serviceId"))
    expect(mocks.toastError).toHaveBeenCalledWith("packages.errors.stepSummary")
  })
})

describe("GroupedPackageFormPage image save result (T11-F1/T11-F2)", () => {
  it("saves the package, then uploads and attaches the image before announcing success", async () => {
    await submitWithImage()

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/packages"))
    expect(mocks.create).toHaveBeenCalledTimes(1)
    expect(mocks.upload).toHaveBeenCalledTimes(1)
    expect(mocks.attach).toHaveBeenCalledWith("pkg-1", "packages/pkg-1/cover.png")
    expect(mocks.toastSuccess).toHaveBeenCalledWith("packages.create.success")
    expect(mocks.toastError).not.toHaveBeenCalled()
    expect(mocks.create.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.upload.mock.invocationCallOrder[0],
    )
    expect(mocks.upload.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.toastSuccess.mock.invocationCallOrder[0],
    )
  })

  it("never announces success and never attaches when the image upload fails", async () => {
    mocks.upload.mockRejectedValueOnce(new Error("Upload failed"))
    await submitWithImage()

    await waitFor(() => expect(mocks.toastError.mock.calls.map(String).join("|")).toContain("imageUpload"))
    expect(mocks.toastSuccess).not.toHaveBeenCalled()
    expect(mocks.attach).not.toHaveBeenCalled()
    expect(mocks.cleanup).not.toHaveBeenCalled()
    expect(mocks.push).not.toHaveBeenCalledWith("/packages")
  })

  it("deletes the orphaned upload and never announces success when attach fails", async () => {
    mocks.attach.mockRejectedValueOnce(new Error("attach failed"))
    await submitWithImage()

    await waitFor(() => expect(mocks.toastError.mock.calls.map(String).join("|")).toContain("imageAttach"))
    expect(mocks.toastSuccess).not.toHaveBeenCalled()
    expect(mocks.push).not.toHaveBeenCalledWith("/packages")
    expect(mocks.cleanup).toHaveBeenCalledWith("media-1")
    expect(mocks.upload).toHaveBeenCalledTimes(1)
    expect(mocks.attach).toHaveBeenCalledTimes(1)
  })
})

describe("GroupedPackageFormPage removed avatar (t12)", () => {
  it("never uploads the staged file after the avatar is cleared", async () => {
    await submitWithImage({
      onDetails: () => fireEvent.click(screen.getByRole("button", { name: "clear-image" })),
    })

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/packages"))
    // The package still saves; only the removed image is skipped.
    expect(mocks.create).toHaveBeenCalledTimes(1)
    expect(mocks.upload).not.toHaveBeenCalled()
    expect(mocks.attach).not.toHaveBeenCalled()
    expect(mocks.toastSuccess).toHaveBeenCalledWith("packages.create.success")
    // The removed avatar is an explicit removal, never the dropped blob URL.
    expect(mocks.create.mock.calls[0][0].imageUrl).toBeNull()
  })

  it("never uploads the staged file after an icon replaces the avatar", async () => {
    await submitWithImage({
      onDetails: () => fireEvent.click(screen.getByRole("button", { name: "choose-icon" })),
    })

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/packages"))
    expect(mocks.create).toHaveBeenCalledTimes(1)
    expect(mocks.upload).not.toHaveBeenCalled()
    expect(mocks.attach).not.toHaveBeenCalled()
    expect(mocks.toastSuccess).toHaveBeenCalledWith("packages.create.success")
  })
})

describe("GroupedPackageFormPage submit lock (t12)", () => {
  it("runs the save once when the form is submitted twice while the first attempt is in flight", async () => {
    let releaseCreate: (value: { id: string }) => void = () => {}
    mocks.create.mockImplementationOnce(
      () => new Promise<{ id: string }>((resolve) => { releaseCreate = resolve }),
    )
    const form = await submitWithImage()

    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1))
    // The submit button is disabled for the whole save + upload + attach flow.
    expect(
      screen.getByRole("button", { name: "packages.create.submitting" }),
    ).toBeDisabled()

    // Second submit while the first save is still unresolved.
    fireEvent.submit(form)
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(mocks.create).toHaveBeenCalledTimes(1)

    releaseCreate({ id: "pkg-1" })
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/packages"))
    expect(mocks.create).toHaveBeenCalledTimes(1)
    expect(mocks.upload).toHaveBeenCalledTimes(1)
    expect(mocks.attach).toHaveBeenCalledTimes(1)
    expect(mocks.toastSuccess).toHaveBeenCalledTimes(1)
  })

  it("releases the lock at the end of a failed attempt", async () => {
    let releaseUpload: () => void = () => {}
    mocks.upload.mockImplementationOnce(
      () => new Promise<never>((_resolve, reject) => { releaseUpload = () => reject(new Error("Upload failed")) }),
    )
    const form = await submitWithImage()

    await waitFor(() => expect(mocks.upload).toHaveBeenCalledTimes(1))
    expect(screen.getByRole("button", { name: "packages.create.submitting" })).toBeDisabled()
    releaseUpload()

    // The lock ends with the flow: the button returns to its idle label.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "packages.create.submit" })).toBeEnabled(),
    )
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1))
    fireEvent.submit(form)
    await new Promise((resolve) => setTimeout(resolve, 20))
    // The failed attempt was the only create; nothing duplicating it ran.
    expect(mocks.create).toHaveBeenCalledTimes(1)
  })
})
