import { renderHook, waitFor, act } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { createWrapper } from "@/test/helpers/wrapper"

const {
  fetchDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} = vi.hoisted(() => ({
  fetchDepartments: vi.fn(),
  createDepartment: vi.fn(),
  updateDepartment: vi.fn(),
  deleteDepartment: vi.fn(),
}))

vi.mock("@/lib/api/departments", () => ({
  fetchDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
}))

import {
  useDepartments,
  useDepartmentOptions,
  useDepartmentMutations,
} from "@/hooks/use-departments"

describe("useDepartments", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetches departments and returns items", async () => {
    const items = [{ id: "d-1", nameAr: "قلبية" }]
    fetchDepartments.mockResolvedValueOnce({ items, meta: { total: 1 } })

    const { result } = renderHook(() => useDepartments(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(fetchDepartments).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, perPage: 20 }),
    )
    expect(result.current.departments).toEqual(items)
    expect(result.current.meta).toEqual({ total: 1 })
  })

  it("returns loading state initially", () => {
    fetchDepartments.mockReturnValueOnce(new Promise(() => undefined))

    const { result } = renderHook(() => useDepartments(), { wrapper: createWrapper() })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.departments).toEqual([])
  })

  it("passes search to api and resets page", async () => {
    fetchDepartments.mockResolvedValue({ items: [], meta: { total: 0 } })

    const { result } = renderHook(() => useDepartments(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => { result.current.setSearch("قلبية") })

    await waitFor(() =>
      expect(fetchDepartments).toHaveBeenCalledWith(
        expect.objectContaining({ search: "قلبية", page: 1 }),
      ),
    )
  })

  it("resetFilters clears search and isActive", async () => {
    fetchDepartments.mockResolvedValue({ items: [], meta: { total: 0 } })

    const { result } = renderHook(() => useDepartments(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => { result.current.setIsActive(true) })
    await waitFor(() => expect(result.current.isActive).toBe(true))

    act(() => { result.current.resetFilters() })
    await waitFor(() => expect(result.current.isActive).toBeUndefined())
    expect(result.current.search).toBe("")
    expect(result.current.page).toBe(1)
  })
})

describe("useDepartmentOptions", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetches active departments for dropdowns", async () => {
    const items = [{ id: "d-1", nameAr: "قلبية", isActive: true }]
    fetchDepartments.mockResolvedValueOnce({ items, meta: { total: 1 } })

    const { result } = renderHook(() => useDepartmentOptions(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.options).toEqual(items)
  })
})

describe("useDepartmentMutations", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("createMut calls createDepartment", async () => {
    createDepartment.mockResolvedValueOnce({ id: "d-new" })

    const { result } = renderHook(() => useDepartmentMutations(), { wrapper: createWrapper() })

    act(() => {
      result.current.createMut.mutate({ nameAr: "جلدية" } as Parameters<typeof createDepartment>[0])
    })

    await waitFor(() => expect(createDepartment).toHaveBeenCalled())
  })

  it("updateMut calls updateDepartment with id and payload", async () => {
    updateDepartment.mockResolvedValueOnce({ id: "d-1" })

    const { result } = renderHook(() => useDepartmentMutations(), { wrapper: createWrapper() })

    act(() => {
      result.current.updateMut.mutate({ id: "d-1", nameAr: "updated" } as Parameters<typeof result.current.updateMut.mutate>[0])
    })

    await waitFor(() => expect(updateDepartment).toHaveBeenCalledWith("d-1", expect.objectContaining({ nameAr: "updated" })))
  })

})
