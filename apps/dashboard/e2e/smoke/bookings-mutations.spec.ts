/**
 * bookings-mutations.spec.ts
 *
 * Smoke for the two production-skew mutations:
 *   POST  /api/proxy/dashboard/finance/bookings/:id/collect
 *   PATCH /api/proxy/dashboard/bookings/:id/restore-no-show
 *
 * These must go through the Next.js `/api/proxy` rewrite (same path the
 * dashboard client uses) against the CI production binaries (`next start` +
 * `node dist/src/main.js`). A missing backend route surfaces as Express/Nest
 * `Cannot POST/PATCH ...`; a broken rewrite surfaces as HTML 404. Either
 * is a failure. An application JSON status (401/400/404 Booking not found)
 * proves the canonical route is mounted.
 *
 * Does not target production: aborts unless the dashboard origin is local.
 */
import { test, expect, type APIResponse } from "@playwright/test"
import { loginAs } from "../fixtures/auth"
import { getPersonaToken } from "../fixtures/seed"

const DASHBOARD_BASE = process.env.PW_DASHBOARD_URL ?? "http://localhost:5203"
const SYNTHETIC_BOOKING_ID = "00000000-0000-4000-a000-000000000001"

const COLLECT_PROXY = `/api/proxy/dashboard/finance/bookings/${SYNTHETIC_BOOKING_ID}/collect`
const RESTORE_PROXY = `/api/proxy/dashboard/bookings/${SYNTHETIC_BOOKING_ID}/restore-no-show`

function assertLocalDashboard(): void {
  const host = new URL(DASHBOARD_BASE).hostname
  if (host !== "localhost" && host !== "127.0.0.1") {
    throw new Error(
      `Refusing bookings-mutations smoke against non-local host ${host}`
    )
  }
}

function assertCanonicalRouteReached(
  res: APIResponse,
  method: "POST" | "PATCH",
  pathSuffix: string
): void {
  const url = res.url()
  expect(url, `${method} must go through /api/proxy`).toContain("/api/proxy/")
  expect(url).toContain(pathSuffix)

  const status = res.status()
  expect(
    [200, 201, 400, 401, 403, 404, 409, 422].includes(status),
    `${method} ${pathSuffix} returned unexpected HTTP ${status}`
  ).toBe(true)

  const contentType = res.headers()["content-type"] ?? ""
  expect(
    contentType,
    `${method} ${pathSuffix} must be JSON from Nest, not a Next/HTML miss`
  ).toMatch(/json/i)
}

test.describe("canonical booking mutations via /api/proxy", () => {
  test.beforeEach(() => {
    assertLocalDashboard()
  })

  test("POST collect and PATCH restore-no-show are mounted through the proxy", async ({
    page,
  }) => {
    await loginAs(page, "admin")
    const token = await getPersonaToken("admin")

    const collect = await page.request.post(COLLECT_PROXY, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      data: { method: "CASH" },
    })
    const collectBody = await collect.text()
    expect(
      collectBody,
      "collect must not 404 as an unregistered Express/Nest route"
    ).not.toMatch(/Cannot POST/i)
    assertCanonicalRouteReached(collect, "POST", "/collect")

    const restore = await page.request.patch(RESTORE_PROXY, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      data: { reason: "smoke restore no-show" },
    })
    const restoreBody = await restore.text()
    expect(
      restoreBody,
      "restore-no-show must not 404 as an unregistered Express/Nest route"
    ).not.toMatch(/Cannot PATCH/i)
    assertCanonicalRouteReached(restore, "PATCH", "/restore-no-show")
  })
})
