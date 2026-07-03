/**
 * programs-edit-submit.spec.ts
 *
 * Browser smoke for the program edit wiring: `/programs/[id]/edit` must
 * PATCH the existing program — NOT POST a duplicate row.
 *
 * Backend evidence target: after changing a field on the edit form and
 * clicking save, the page must issue a PATCH to `/dashboard/programs/:id`
 * and redirect back to `/programs/:id` (NOT a freshly-created program's
 * page with a new ref number).
 *
 * Requires: backend on :5200, dashboard on :5203, seeded admin
 * (next.dev login).
 *
 * Why we seed a dedicated DRAFT program instead of clicking the first
 * row in the list:
 *   1. The list page renders rows via `<DataTable>` whose name column is
 *      a `<Button variant="link" onSelect=...>` — NOT an `<a href>` —
 *      so an `a[href^="/programs/"]` selector would never match.
 *   2. The dashboard zod schema (`createProgramSchema`) requires valid
 *      UUIDs for `departmentId` + `branchId` AND `supervisorIds.min(1)`.
 *      Loading a stale / orphaned draft with empty supervisors makes RHF
 *      block submit before any network call fires, masking the bug the
 *      spec is supposed to cover.
 *
 * seedProgram guarantees a COMPLETE, EDITABLE DRAFT program so the
 * load → reset → submit pipeline reaches PATCH deterministically.
 */
import { test, expect } from "@playwright/test"
import { loginAs } from "../fixtures/auth"
import { expectAuthenticatedShell, expectNoAppCrash } from "../fixtures/assertions"
import {
  cleanupProgram,
  getPersonaToken,
  seedProgram,
  type SeededProgram,
} from "../fixtures/seed"

test.describe("program edit submit (smoke)", () => {
  let program: SeededProgram
  let adminToken: string

  test.beforeAll(async () => {
    // Resolve a token BEFORE the page-driven test so the API helper runs
    // outside the browser cookie race that fixtures/auth.loginAs handles.
    adminToken = await getPersonaToken("admin")
    program = await seedProgram(adminToken)
  })

  test.afterAll(async () => {
    if (program?.id && adminToken) {
      // The programs controller has no DELETE; cancel-after-DRAFT is the
      // cleanest terminal transition. Best-effort — see cleanupProgram.
      await cleanupProgram(program.id, adminToken)
    }
  })

  test("PATCH /dashboard/programs/:id on save — no duplicate row", async ({
    page,
  }) => {
    const apiCalls: { method: string; url: string }[] = []
    page.on("request", (req) => {
      const url = req.url()
      if (url.includes("/dashboard/programs")) {
        apiCalls.push({ method: req.method(), url })
      }
    })

    await loginAs(page, "admin")
    await expectAuthenticatedShell(page)

    // Navigate DIRECTLY to the edit route for the seeded program. Skipping
    // the list page avoids the no-anchor row-click problem and removes the
    // selection ambiguity the previous version of this spec had.
    await page.goto(`/programs/${program.id}/edit`, {
      waitUntil: "domcontentloaded",
    })
    await expectNoAppCrash(page)

    // The edit form's nameAr input must be present (this confirms the page
    // has loaded the program detail and rendered the real form, not the
    // loading placeholder).
    const nameInput = page.locator('input[name="nameAr"]')
    await expect(nameInput).toBeVisible({ timeout: 15_000 })

    // Wait for useProgram's GET /dashboard/programs/:id to resolve so the
    // `useEffect → form.reset(fromExisting(existing))` effect has run with
    // valid departmentId/branchId/supervisorIds. Without this, RHF may
    // briefly hold the EMPTY_DEFAULTS (supervisorIds: []) which the zod
    // schema rejects, blocking submit before any network call fires.
    await page
      .waitForResponse(
        (r) =>
          r.url().includes(`/dashboard/programs/${program.id}`) &&
          r.request().method() === "GET" &&
          r.ok(),
        { timeout: 15_000 },
      )
      .catch(() => undefined)

    // Re-read the input value AFTER reset so we capture the loaded nameAr
    // (not the empty defaults) and prove the form populated correctly.
    const originalName = (await nameInput.inputValue()) ?? ""
    expect(
      originalName.length,
      "edit form's nameAr should be populated by the loaded detail",
    ).toBeGreaterThan(0)

    const taggedName = `${originalName} — تعديل ${Date.now()}`
    await nameInput.fill(taggedName)

    // Submit the form. ProgramFormPage routes through useUpdateProgram in
    // edit mode, which fires PATCH /dashboard/programs/:id; on success the
    // success handler does router.push(`/programs/${id}`).
    await page.getByRole("button", { name: /(save|حفظ)/i }).click()

    // Wait for the redirect-after-save. Edit mode → /programs/:id (same id,
    // NOT a new one — the whole point of the spec).
    await page.waitForURL((u) => u.pathname === `/programs/${program.id}`, {
      timeout: 20_000,
    })

    // The API log must contain PATCH /dashboard/programs/:id.
    const patched = apiCalls.find(
      (c) =>
        c.method === "PATCH" &&
        c.url.includes(`/dashboard/programs/${program.id}`),
    )
    expect(patched, "PATCH /dashboard/programs/:id observed").toBeTruthy()

    // No POST /dashboard/programs (root) — that would be a duplicate row.
    // Tolerate the trailing `?…` query string the api client may append.
    const postedRoot = apiCalls.find(
      (c) =>
        c.method === "POST" &&
        /\/dashboard\/programs\/?(\?|$)/.test(c.url),
    )
    expect(postedRoot, "POST /dashboard/programs NOT observed (no duplicate row)").toBeFalsy()

    // The detail page should now show the new name.
    await expect(page.getByText(taggedName).first()).toBeVisible({
      timeout: 10_000,
    })
  })
})
