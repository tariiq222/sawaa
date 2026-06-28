import { describe, expect, it, vi } from "vitest"
import type { QueryClient } from "@tanstack/react-query"
import { ROUTE_PREFETCH, prefetchRouteData } from "@/lib/route-prefetch"
import { queryKeys } from "@/lib/query-keys"

function makeQueryClient(impl?: (opts: unknown) => Promise<void>) {
  const prefetchQuery = vi.fn<(opts: unknown) => Promise<void>>(
    impl ?? (() => Promise.resolve()),
  )
  return { qc: { prefetchQuery } as unknown as QueryClient, prefetchQuery }
}

describe("prefetchRouteData", () => {
  it("silently no-ops for routes without a prefetch entry", () => {
    const { qc, prefetchQuery } = makeQueryClient()
    prefetchRouteData("/reports", qc)
    prefetchRouteData("/settings", qc)
    prefetchRouteData("/definitely-not-a-route", qc)
    expect(prefetchQuery).not.toHaveBeenCalled()
  })

  it("prefetches /bookings with the exact queryKey used by the bookings hook", () => {
    const { qc, prefetchQuery } = makeQueryClient()
    prefetchRouteData("/bookings", qc)
    expect(prefetchQuery).toHaveBeenCalledTimes(1)
    expect(prefetchQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.bookings.list({ page: 1, limit: 20 }),
      }),
    )
  })

  it("uses the QueryProvider default staleTime (5 minutes) for every entry", () => {
    const { qc, prefetchQuery } = makeQueryClient()
    for (const href of Object.keys(ROUTE_PREFETCH)) prefetchRouteData(href, qc)
    expect(prefetchQuery).toHaveBeenCalledTimes(Object.keys(ROUTE_PREFETCH).length)
    for (const call of prefetchQuery.mock.calls) {
      expect(call[0]).toMatchObject({ staleTime: 5 * 60_000 })
    }
  })

  it("keeps each route's queryKey aligned with lib/query-keys", () => {
    const { qc, prefetchQuery } = makeQueryClient()
    const expected: Record<string, readonly unknown[]> = {
      "/clients": queryKeys.clients.list({ page: 1, limit: 20 }),
      "/services": queryKeys.services.list({}),
      "/chatbot": queryKeys.chatbot.sessions.list({ page: 1, limit: 20 }),
    }
    for (const [href, queryKey] of Object.entries(expected)) {
      prefetchQuery.mockClear()
      prefetchRouteData(href, qc)
      expect(prefetchQuery).toHaveBeenCalledWith(expect.objectContaining({ queryKey }))
    }
  })

  it("swallows prefetch rejections instead of surfacing them", async () => {
    const { qc } = makeQueryClient(() => Promise.reject(new Error("network down")))
    expect(() => prefetchRouteData("/bookings", qc)).not.toThrow()
    // flush the rejected promise — an unhandled rejection would fail the test run
    await new Promise((r) => setTimeout(r, 0))
  })
})
