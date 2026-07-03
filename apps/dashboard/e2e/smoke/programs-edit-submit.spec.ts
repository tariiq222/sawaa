/**
 * programs-edit-submit.spec.ts
 *
 * Browser smoke for the program edit wiring: `/programs/[id]/edit` must
 * PATCH the existing program — NOT POST a duplicate.
 *
 * Backend evidence target: after changing a field on the edit form and
 * clicking save, the page must issue a PATCH to `/dashboard/programs/:id`
 * and redirect back to the program's detail page (NOT a freshly-created
 * program's page with a new ref number).
 *
 * Requires: backend on :5200, dashboard on :5203, seeded admin
 * (next.dev login), at least one DRAFT program visible to the admin
 * account.
 *
 * NOTE (env blocker for the current run): the Sawa dev docker stack is
 * not currently up on this machine — only an unrelated `athar-*` project
 * stack is running. This spec is committed so the smoke gate exists for
 * the next QA run; it was authored but NOT executed in this turn. The
 * verified gate for the P0-B edit-routing fix lives in the jsdom unit
 * tree at `test/unit/components/features/program-form-page-edit-routing.spec.tsx`.
 */

import { test, expect } from "@playwright/test"
import { loginAs } from "../fixtures/auth"
import { expectAuthenticatedShell, expectNoAppCrash } from "../fixtures/assertions"

test.describe("program edit submit (smoke)", () => {
  test("PATCH /dashboard/programs/:id on save — no duplicate row", async ({ page }) => {
    const apiCalls: { method: string; url: string }[] = []
    page.on("request", (req) => {
      const url = req.url()
      if (url.includes("/dashboard/programs")) {
        apiCalls.push({ method: req.method(), url })
      }
    })

    await loginAs(page, "admin")
    await expectAuthenticatedShell(page)

    // Land on the programs list and click the first row.
    await page.goto("/programs", { waitUntil: "domcontentloaded" })
    await expectNoAppCrash(page)

    // The list renders program rows — click the first row link.
    const firstProgramLink = page
      .locator('a[href^="/programs/"]:not([href="/programs"])')
      .first()
    await expect(firstProgramLink).toBeVisible({ timeout: 10_000 })
    await firstProgramLink.click()

    // We should be on /programs/[id] — go to the edit route.
    await expect(page).toHaveURL(/\/programs\/[^/]+$/)
    const programUrl = page.url()
    const programId = programUrl.match(/\/programs\/([^/?]+)/)?.[1]
    expect(programId, "program id extracted from URL").toBeTruthy()

    await page.goto(`/programs/${programId}/edit`, { waitUntil: "domcontentloaded" })

    // The edit form's nameAr input must be present.
    const nameInput = page.locator('input[name="nameAr"]')
    await expect(nameInput).toBeVisible({ timeout: 10_000 })

    // Capture the original name to verify it changes (and we are editing,
    // not creating a new program).
    const originalName = (await nameInput.inputValue()) ?? ""
    const taggedName = `${originalName} — تعديل ${Date.now()}`
    await nameInput.fill(taggedName)

    // Submit the form. The page redirects to /programs/:id (same id, NOT a new one).
    await page.getByRole("button", { name: /(save|حفظ)/i }).click()

    // Wait for the redirect-after-save. Edit mode → /programs/:id (not a new id).
    await page.waitForURL((u) => u.pathname === `/programs/${programId}`, {
      timeout: 15_000,
    })

    // The API log must contain PATCH /dashboard/programs/:id.
    const patched = apiCalls.find(
      (c) => c.method === "PATCH" && c.url.includes(`/dashboard/programs/${programId}`),
    )
    expect(patched, "PATCH /dashboard/programs/:id observed").toBeTruthy()

    // No POST /dashboard/programs (root) — that would be a duplicate row.
    const postedRoot = apiCalls.find(
      (c) => c.method === "POST" && /\/dashboard\/programs\/?(\?|$)/.test(c.url),
    )
    expect(postedRoot, "POST /dashboard/programs NOT observed (no duplicate row)").toBeFalsy()

    // The detail page should now show the new name.
    await expect(page.getByText(taggedName).first()).toBeVisible({ timeout: 10_000 })
  })
})