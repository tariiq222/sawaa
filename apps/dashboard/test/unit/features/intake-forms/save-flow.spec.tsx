import { act, Suspense } from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { IntakeFormDraft } from "@/lib/types/intake-form"
import CreatePage from "@/app/(dashboard)/intake-forms/create/page"
import EditPage from "@/app/(dashboard)/intake-forms/[id]/edit/page"

const mocks = vi.hoisted(() => ({
  get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), push: vi.fn(),
  error: vi.fn(), success: vi.fn(), draft: {} as IntakeFormDraft,
}))
vi.mock("@/lib/api", () => ({ api: mocks }))
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
  usePathname: () => "/intake-forms", useSearchParams: () => new URLSearchParams(),
}))
vi.mock("sonner", () => ({ toast: { success: mocks.success } }))
vi.mock("@/lib/mutation-helpers", () => ({ showApiError: mocks.error }))
vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({ locale: "en", t: (key: string) => key }),
}))
vi.mock("@/components/features/permission-guard", () => ({
  PermissionGuard: ({ children }: { children: React.ReactNode }) => children,
}))
// Exercise the real pages, hooks, adapter and API serialization; replace only
// the form editor with a deterministic draft to isolate save orchestration.
vi.mock("@/components/features/intake-forms/intake-form-page", () => ({
  IntakeFormPage: ({ onSave, isLoadingDraft, isSaving }: {
    onSave: (draft: IntakeFormDraft) => void; isLoadingDraft?: boolean; isSaving?: boolean
  }) => <button disabled={isLoadingDraft || isSaving} onClick={() => onSave(mocks.draft)}>Save</button>,
}))

const form = {
  id: "10000000-0000-4000-8000-000000000001", ref: 1,
  nameAr: "نموذج", nameEn: "Form", type: "PRE_BOOKING", scope: "GLOBAL",
  scopeId: null, isActive: true, submissionsCount: 0,
  createdAt: "2026-09-05T00:00:00.000Z", updatedAt: "2026-09-05T00:00:00.000Z",
  fields: [{ id: "field-1", formId: "10000000-0000-4000-8000-000000000001",
    labelAr: "السؤال", labelEn: null, fieldType: "TEXT", options: null,
    isRequired: false, position: 0 }],
}

async function save(mode: "create" | "edit", beforeSave?: (client: QueryClient) => Promise<void>) {
  const client = new QueryClient({ defaultOptions: {
    queries: { retry: false, gcTime: 0 }, mutations: { retry: false },
  } })
  const params = Promise.resolve({ id: "FRM-1" })
  await act(async () => { render(<QueryClientProvider client={client}><Suspense fallback="Loading">
    {mode === "create" ? <CreatePage /> : <EditPage params={params} />}
  </Suspense></QueryClientProvider>) })
  await waitFor(() => expect(screen.getByRole("button", { name: "Save" })).toBeEnabled())
  if (beforeSave) await act(async () => { await beforeSave(client) })
  fireEvent.click(screen.getByRole("button", { name: "Save" }))
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.get.mockResolvedValue(form)
  mocks.post.mockResolvedValue(form)
  mocks.patch.mockResolvedValue(form)
  mocks.put.mockResolvedValue(form)
  mocks.draft = {
    nameAr: "نموذج", nameEn: "Form", type: "pre_booking", scope: "global",
    scopeId: "", isActive: true,
    fields: [{ id: "field-1", labelAr: "السؤال", labelEn: "", type: "text",
      required: false, options: [] }],
  }
})

describe("Intake form save flow", () => {
  it("retains the original editing baseline when the query refetches another operator's changes", async () => {
    mocks.draft.nameAr = "اسم جديد"
    await save("edit", async (client) => {
      mocks.get.mockResolvedValueOnce({ ...form, nameEn: "Changed elsewhere", type: "REGISTRATION" })
      await client.refetchQueries()
    })
    await waitFor(() => expect(mocks.push).toHaveBeenCalled())
    expect(mocks.patch).toHaveBeenCalledWith(`/dashboard/organization/intake-forms/${form.id}`, { nameAr: "اسم جديد" })
  })

  it("creates metadata and fields in a single request", async () => {
    await save("create")
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/intake-forms"))
    expect(mocks.post).toHaveBeenCalledWith("/dashboard/organization/intake-forms", expect.objectContaining({
      type: "PRE_BOOKING", scope: "GLOBAL",
      fields: [expect.objectContaining({ labelAr: "السؤال", fieldType: "TEXT", position: 0 })],
    }))
    expect(mocks.put).not.toHaveBeenCalled()
  })

  it("persists type and scope using the resolved UUID and preserves unchanged field IDs", async () => {
    mocks.draft.type = "post_session"
    mocks.draft.scope = "service"
    mocks.draft.scopeId = "service-1"
    await save("edit")
    await waitFor(() => expect(mocks.push).toHaveBeenCalled())
    expect(mocks.patch).toHaveBeenCalledWith(`/dashboard/organization/intake-forms/${form.id}`, {
      type: "POST_SESSION", scope: "SERVICE", scopeId: "service-1",
    })
    expect(mocks.put).not.toHaveBeenCalled()
  })

  it("sends changed fields in the same PATCH and explicitly clears the global scope target", async () => {
    mocks.get.mockResolvedValueOnce({ ...form, scope: "SERVICE", scopeId: "service-1" })
    mocks.draft.fields[0].labelAr = "سؤال جديد"
    await save("edit")
    await waitFor(() => expect(mocks.push).toHaveBeenCalled())
    expect(mocks.patch).toHaveBeenCalledWith(`/dashboard/organization/intake-forms/${form.id}`, expect.objectContaining({
      scope: "GLOBAL", scopeId: null,
      fields: [expect.objectContaining({ labelAr: "سؤال جديد", fieldType: "TEXT" })],
    }))
    expect(mocks.put).not.toHaveBeenCalled()
  })

  it("keeps the editor open when atomic save fails", async () => {
    mocks.draft.nameAr = "اسم جديد"
    mocks.patch.mockRejectedValueOnce(new Error("Fields are locked"))
    await save("edit")
    await waitFor(() => expect(mocks.error).toHaveBeenCalled())
    expect(mocks.success).not.toHaveBeenCalled()
    expect(mocks.push).not.toHaveBeenCalled()
    expect(mocks.put).not.toHaveBeenCalled()
  })
})
