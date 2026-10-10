import { renderHook, waitFor, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { describe, it, expect, vi } from "vitest"
import type { ReactNode } from "react"
const { fetchEmployees, fetchServices, fetchBranches } = vi.hoisted(() => ({ fetchEmployees: vi.fn(), fetchServices: vi.fn(), fetchBranches: vi.fn() }))
vi.mock("@/lib/api/employees", () => ({ fetchEmployees }))
vi.mock("@/lib/api/services", () => ({ fetchServices }))
vi.mock("@/lib/api/branches", () => ({ fetchBranches }))
import { useIntakeScopeOptions } from "@/hooks/use-intake-scope-options"
const wrapper = ({children}: {children: ReactNode}) => <QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}>{children}</QueryClientProvider>
describe("intake scope selectors", () => {
  it("loads a later employee page and keeps Arabic employee names", async () => {
    fetchEmployees.mockImplementation(({page}) => Promise.resolve({items:[{id:`e${page}`,nameAr:`أخصائي ${page}`,user:{firstName:"English",lastName:`${page}`}}],meta:{page,hasNextPage:page===1}}))
    const {result} = renderHook(() => useIntakeScopeOptions("employee", "ar"), {wrapper})
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.pages[0].items[0].label).toBe("أخصائي 1")
    await act(async () => {await result.current.fetchNextPage()})
    expect(fetchEmployees).toHaveBeenLastCalledWith({page:2,limit:100})
    await waitFor(() => expect(result.current.data?.pages.flatMap(p => p.items).map(o => o.value)).toEqual(["e1","e2"]))
    expect(result.current.hasNextPage).toBe(false)
  })
})
