/**
 * ProgramFormPage — REAL component tree test for the edit-mode routing fix.
 *
 * Verifier gap (P0-B): the unit tests covered the API wrapper and the
 * mutation hooks, but the actual page component that wires them together
 * was only covered by the helper-level test. This spec closes the gap by
 * rendering the REAL <ProgramFormPage> with REAL useUpdateProgram and
 * useCreateProgram hooks — only the network boundary (api.{get,post,patch}
 * + the public fetch) and next/navigation are mocked.
 *
 * Asserts per assertion:
 *  - edit mode:      api.patch('/dashboard/programs/:id', _ ) called
 *  - edit mode:      api.post ('/dashboard/programs'    , _ ) NOT called
 *  - create mode:    api.post ('/dashboard/programs'    , _ ) called
 *  - create mode:    api.patch('/dashboard/programs/:id', _ ) NOT called
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, fireEvent, waitFor, screen, cleanup } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { LocaleProvider } from "@/components/locale-provider"
import type { ReactNode } from "react"

const PROGRAM_ID = "00000000-4000-4000-a000-0000000000aa"
const DEPARTMENT_ID = "00000000-0000-4000-a000-000000000001"
const BRANCH_ID = "00000000-0000-4000-a000-000000000002"
const SUPERVISOR_ID = "00000000-0000-4000-a000-000000000003"

const apiGet = vi.hoisted(() => vi.fn())
const apiPost = vi.hoisted(() => vi.fn())
const apiPatch = vi.hoisted(() => vi.fn())

// Replace the dashboard's `api` object with hoisted, observable mocks so the
// REAL useCreateProgram / useUpdateProgram / useProgram / useEmployees /
// useDepartmentOptions / useBranches hooks fire into our spies.
vi.mock("@/lib/api", () => ({
  api: {
    get: apiGet,
    post: apiPost,
    patch: apiPatch,
    put: vi.fn(),
    delete: vi.fn(),
  },
  setAccessToken: vi.fn(),
  getAccessToken: vi.fn(() => null),
  ApiError: class ApiError extends Error {
    constructor(message: string, public status: number, public body: unknown) {
      super(message)
      this.name = "ApiError"
    }
  },
  clearLegacyAccessTokenStorage: vi.fn(),
}))

// Keep the public-programs fetch on a stub so nothing else hits the wire.
const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() => {
  return Promise.resolve(new Response(JSON.stringify({ items: [] }), { status: 200 }))
})

const pushMock = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/programs",
  useSearchParams: () => new URLSearchParams(),
}))

// ─── Fixtures ────────────────────────────────────────────────────────────

function existingProgramDetail() {
  return {
    id: PROGRAM_ID,
    ref: 1,
    status: "DRAFT",
    departmentId: DEPARTMENT_ID,
    branchId: BRANCH_ID,
    nameAr: "قديم",
    nameEn: null,
    descriptionAr: null,
    descriptionEn: null,
    startDate: null,
    daysCount: 4,
    hoursPerDay: 2,
    minParticipants: 4,
    maxParticipants: 10,
    enrolledCount: 0,
    price: "50000",
    currency: "SAR",
    depositEnabled: false,
    depositAmount: null,
    isPublic: false,
    publicDescriptionAr: null,
    publicDescriptionEn: null,
    cancelReason: null,
    cancelledAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    supervisorIds: [SUPERVISOR_ID],
    isFull: false,
    enrollments: [],
  }
}

function paginatedEmpty() {
  return { items: [], meta: { page: 1, limit: 50, total: 0 } }
}

function setupApiMocksForEdit() {
  // GET /dashboard/programs/:id (real fetchProgram via api.get)
  apiGet.mockImplementation((endpoint: string) => {
    if (endpoint.startsWith("/dashboard/programs/")) {
      return Promise.resolve(existingProgramDetail())
    }
    if (endpoint.startsWith("/dashboard/employees")) {
      return Promise.resolve(paginatedEmpty())
    }
    if (endpoint.startsWith("/dashboard/departments")) {
      return Promise.resolve(paginatedEmpty())
    }
    if (endpoint.startsWith("/dashboard/branches")) {
      return Promise.resolve(paginatedEmpty())
    }
    return Promise.resolve([])
  })
  apiPatch.mockResolvedValueOnce({ id: PROGRAM_ID, ref: 1, status: "DRAFT", supervisorIds: [SUPERVISOR_ID] })
  apiPost.mockReset()
}

function setupApiMocksForCreate() {
  apiGet.mockImplementation((endpoint: string) => {
    if (endpoint.startsWith("/dashboard/people/employees")) {
      // ProgramFormSupervisors → useEmployees → fetchEmployees renders one
      // selectable employee so the test can click it and seed a valid
      // supervisorIds. The schema requires ≥1.
      return Promise.resolve({
        items: [{ id: SUPERVISOR_ID, name: "Dr Test Supervisor", specialty: "Counseling" }],
        meta: { page: 1, limit: 50, total: 1 },
      })
    }
    if (endpoint.startsWith("/dashboard/organization/departments")) {
      // ProgramFormBasics → useDepartmentOptions needs a matching <option>
      // so setByName("departmentId", …) actually lands a UUID on the select.
      return Promise.resolve({
        items: [{ id: DEPARTMENT_ID, nameAr: "قسم" }],
        meta: { page: 1, limit: 100, total: 1 },
      })
    }
    if (endpoint.startsWith("/dashboard/organization/branches")) {
      return Promise.resolve({
        items: [{ id: BRANCH_ID, nameAr: "فرع" }],
        meta: { page: 1, limit: 50, total: 1 },
      })
    }
    return Promise.resolve([])
  })
  apiPost.mockResolvedValueOnce({ id: "new-id" })
  apiPatch.mockReset()
}

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <LocaleProvider>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </LocaleProvider>
    )
  }
  Wrapper.displayName = "Wrapper"
  return { Wrapper, qc: queryClient }
}

beforeEach(() => {
  apiGet.mockReset()
  apiPost.mockReset()
  apiPatch.mockReset()
  pushMock.mockReset()
  fetchSpy.mockClear()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

// ─── Tests ──────────────────────────────────────────────────────────────

describe("ProgramFormPage — real component tree, edit vs create routing", () => {
  it(
    "edit mode: real page submits via PATCH /dashboard/programs/:id (NOT POST)",
    async () => {
      setupApiMocksForEdit()

      const { Wrapper } = makeWrapper()
      const { container } = render(
        <Wrapper>
          <ProgramFormPage mode="edit" programId={PROGRAM_ID} />
        </Wrapper>,
      )

      const form = (await waitFor(() => {
        const el = container.querySelector("form")
        if (!el) throw new Error("form not yet rendered")
        return el as HTMLFormElement
      }, { timeout: 3000 }))

      // Wait for the useProgram GET to resolve + the form.reset effect to
      // populate valid values — at that point RHF validation passes on submit.
      // fetchProgram(id) calls api.get(endpoint) with a single argument.
      await waitFor(() => {
        expect(apiGet).toHaveBeenCalled()
        const calls = apiGet.mock.calls.map((args) => args[0] as string)
        expect(calls.some((url) => url.includes(`/dashboard/programs/${PROGRAM_ID}`))).toBe(true)
      }, { timeout: 3000 })

      // Submit the form (fireEvent.submit triggers the real RHF pipeline).
      fireEvent.submit(form)

      await waitFor(() => {
        expect(apiPatch).toHaveBeenCalledTimes(1)
      }, { timeout: 3000 })

      const [patchUrl, patchBody] = apiPatch.mock.calls[0]
      expect(patchUrl).toBe(`/dashboard/programs/${PROGRAM_ID}`)
      // Same CreateProgramPayload field shape — backend PATCH accepts the
      // edit payload with the same field set.
      expect(patchBody).toMatchObject({
        departmentId: expect.any(String),
        branchId: expect.any(String),
        nameAr: expect.any(String),
        daysCount: expect.any(Number),
        hoursPerDay: expect.any(Number),
        minParticipants: expect.any(Number),
        maxParticipants: expect.any(Number),
        price: expect.any(Number),
        supervisorIds: expect.any(Array),
      })
      // POST /dashboard/programs MUST NOT have been called — that's the bug.
      expect(apiPost).not.toHaveBeenCalled()
    },
    10000,
  )

  it(
    "create mode: real page submits via POST /dashboard/programs (NOT PATCH)",
    async () => {
      setupApiMocksForCreate()

      const { Wrapper } = makeWrapper()
      const { container } = render(
        <Wrapper>
          <ProgramFormPage mode="create" />
        </Wrapper>,
      )

      const form = (await waitFor(() => {
        const el = container.querySelector("form")
        if (!el) throw new Error("form not yet rendered")
        return el as HTMLFormElement
      }, { timeout: 3000 }))

      // Wait for the departments/employees queries to resolve so their
      // <select> options and supervisor list are populated before we try
      // to set values on them.
      await waitFor(() => {
        const calls = apiGet.mock.calls.map((args) => args[0] as string)
        expect(calls.some((u) => u.startsWith("/dashboard/organization/departments"))).toBe(true)
        expect(calls.some((u) => u.startsWith("/dashboard/organization/branches"))).toBe(true)
        expect(calls.some((u) => u.startsWith("/dashboard/people/employees"))).toBe(true)
      }, { timeout: 3000 })

      const setByName = (name: string, value: string) => {
        const el = container.querySelector(`[name="${name}"]`) as
          | HTMLInputElement
          | HTMLSelectElement
          | HTMLTextAreaElement
          | null
        if (el) fireEvent.change(el, { target: { value } })
      }
      setByName("nameAr", "برنامج اختبار")
      setByName("departmentId", DEPARTMENT_ID)
      setByName("branchId", BRANCH_ID)

      // Select the seeded supervisor so the schema's supervisorIds.min(1)
      // validation passes and submit reaches the mutation. The button is
      // rendered by ProgramFormSupervisors once useEmployees resolves.
      const supervisorButton = await waitFor(
        () => screen.getByRole("button", { name: /Dr Test Supervisor/i }),
        { timeout: 3000 },
      )
      fireEvent.click(supervisorButton)

      // Submit the form (fireEvent.submit triggers the real RHF pipeline).
      fireEvent.submit(form)

      // Routing assertion is unconditional: create mode MUST fire
      // POST /dashboard/programs exactly once and MUST NOT fire PATCH.
      await waitFor(() => {
        expect(apiPost).toHaveBeenCalledTimes(1)
      }, { timeout: 3000 })

      expect(apiPost.mock.calls[0][0]).toBe("/dashboard/programs")
      expect(apiPatch).not.toHaveBeenCalled()
    },
    10000,
  )
})

// Imported lazily at the bottom so the hoisted mocks above take effect first.
import { ProgramFormPage } from "@/components/features/programs/program-form-page"