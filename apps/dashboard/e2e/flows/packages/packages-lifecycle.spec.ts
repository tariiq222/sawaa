/**
 * packages-lifecycle.spec.ts
 *
 * E2E: full lifecycle of the session-package (credit-pack) system in the
 * Sawaa dashboard. One serial test exercises:
 *   1. Package creation on /packages via the REAL ScopeControl +
 *      MultiSelect + DurationSelect UI (service → practitioner → duration
 *      → paidQuantity + freeQuantity, single-specific derived-price item).
 *   2. Manual package sale on the client detail page — "بيع باقة",
 *      package + branch + CASH; switch to "أرصدة الباقات" and assert the
 *      credit row shows the seeded service / employee / duration so the
 *      issued credit is provably explicit before any booking action.
 *   3. Book from the credit — "احجز موعد", branch + day + time, submit;
 *      assert `remaining` decremented by 1.
 *   4. Cancel the booking via the backend cancel endpoint → credit is
 *      returned (remaining back to totalQuantity).
 *   5. Refund the package purchase — refund modal, confirm, assert the
 *      purchase card shows REFUNDED ("مستردة") and the credit-book button
 *      is gone.
 *
 * Critical contract: NO fixture PATCH against
 * `/dashboard/organization/packages/:id` may occur between UI creation and
 * the subsequent sale POST — only the create POST's `waitForResponse`
 * matcher and the cleanup DELETE reference that path.
 *
 * All shared setup, teardown, and UI helpers live in
 * `_shared/packages-lifecycle-fixture.ts`. No `test.describe` / `test`
 * registration lives in the helper.
 */
import { test, expect } from "@playwright/test"
import { loginAs } from "../../fixtures/auth"
import { dashboardApiRequest } from "../../fixtures/seed"
import {
  buildPackageItemViaUI,
  pickCreditBookDateCell,
  seedPackagesLifecycleFixtures,
  teardownPackagesLifecycleFixtures,
  type PackagesLifecycleHarness,
} from "./_shared/packages-lifecycle-fixture"

/* ─── Fixture state shared across the lifecycle ───────────────────────── */

// Run-scoped suffix so the package + balance row resolve to THIS run in the
// polluted dev DB (mirrors bookings-status-workflow). The names are set at
// module load and read by both the test body and seedPackagesLifecycleFixtures.
const runId = String(Date.now()).slice(-6)
const harness: PackagesLifecycleHarness = {
  token: "",
  runId,
  packageNameAr: `باقة اختبار ${runId}`,
  clientFirstName: "عميل الباقة",
  clientLastName: `اختبار ${runId}`,
  employeeName: `موظف الباقة ${runId}`,
  seededBranchId: "",
  seededEmployeeId: "",
  seededServiceId: "",
  seededServiceNameAr: "",
  seededClientId: "",
  seededClientName: "",
  seededPackageId: "",
  seededPurchaseId: "",
  seededBookingId: "",
}

/* ─── Test lifecycle ─────────────────────────────────────────────────── */

test.beforeAll(async () => {
  await seedPackagesLifecycleFixtures(harness)
})

test.afterAll(async () => {
  await teardownPackagesLifecycleFixtures(harness)
})

test.describe("Session Packages — dashboard lifecycle", () => {
  test("create → sell → book-from-credit → cancel returns credit → refund shows REFUNDED", async ({
    page,
  }) => {
    test.setTimeout(180_000)

    /* ── 1. Login + create a package on /packages/create ─────────────── */
    await loginAs(page, "admin")

    await page.goto("/packages", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /باقات الجلسات/ })).toBeVisible({
      timeout: 20_000,
    })

    // The "إضافة باقة" button is the create trigger on the empty-state card AND the page-header button. Match by text — they're identical.
    const addBtn = page.getByRole("button", { name: /إضافة باقة/ }).first();
    await expect(addBtn).toBeVisible({ timeout: 10_000 });
    await addBtn.click()

    // Form page: wait for the nameAr input + the item-builder add button.
    await expect(page).toHaveURL(/\/packages\/create/, { timeout: 10_000 });
    const nameArInput = page.locator('input[dir="rtl"]').first();
    await expect(nameArInput).toBeVisible({ timeout: 15_000 });
    await nameArInput.fill(harness.packageNameAr)

    const addItemBtn = page.getByRole("button", { name: /إضافة بند/ });
    await expect(addItemBtn).toBeVisible({ timeout: 10_000 });
    await addItemBtn.click()

    // Drive the package item through the REAL ScopeControl + MultiSelect +
    // DurationSelect UI. The helper asserts the single-specific proof
    // (unitPriceSar input gone + 150.00 SAR in the item grid) and fills
    // paidQuantity/freeQuantity. No fixture PATCH must intervene between
    // this and the sale POST below.
    await buildPackageItemViaUI(page, {
      serviceNameAr: harness.seededServiceNameAr,
      employeeName: harness.employeeName,
    })

    // Discount: leave at the 0 default (finalPrice = 4 × 150 SAR = 600 SAR).

    // Submit the create form. The "إنشاء الباقة" button is type="submit".
    const submitBtn = page.getByRole("button", { name: /إنشاء الباقة/ })
    await expect(submitBtn).toBeEnabled({ timeout: 10_000 })

    // Capture the POST response so we can extract the real package id
    // (the list re-reads the rows on cache invalidation).
    const createResponsePromise = page.waitForResponse(
      (r) =>
        r.url().includes("/dashboard/organization/packages") &&
        r.request().method() === "POST" &&
        r.ok(),
      { timeout: 30_000 },
    )
    await submitBtn.click()
    const createResponse = await createResponsePromise
    const created = (await createResponse.json()) as { id: string }
    harness.seededPackageId = created.id

    // After successful create, the form navigates back to /packages.
    await expect(page).toHaveURL(/\/packages$/, { timeout: 15_000 });
    await expect(
      page.getByRole("cell", { name: new RegExp(harness.packageNameAr) }),
    ).toBeVisible({ timeout: 15_000 })

    /* ── 2. Sell the package to the seeded client ─────────────────────── */
    await page.goto(`/clients/${harness.seededClientId}`, { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: new RegExp(harness.seededClientName) }),
    ).toBeVisible({ timeout: 20_000 });

    const sellBtn = page.getByRole("button", { name: /بيع باقة/ }).first();
    await expect(sellBtn).toBeVisible({ timeout: 10_000 });
    await sellBtn.click()

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await expect(dialog.getByText(/بيع باقة للمستفيد/)).toBeVisible()

    // Package select: id="sell-package" on the trigger.
    const pkgSelect = dialog.locator("#sell-package");
    await expect(pkgSelect).toBeVisible({ timeout: 10_000 });
    await pkgSelect.click();
    await page.getByRole("option", { name: new RegExp(harness.packageNameAr) }).click()

    // Branch select: id="sell-branch" on the trigger.
    const branchSelect = dialog.locator("#sell-branch");
    await expect(branchSelect).toBeVisible({ timeout: 10_000 });
    await branchSelect.click();
    await page.getByRole("option").filter({ hasText: /اختبار/ }).first().click()

    // CASH is the default-enabled radiogroup option — select it explicitly.
    const cashRadio = dialog.getByRole("radio", { name: /نقداً/ });
    await expect(cashRadio).toBeVisible({ timeout: 10_000 });
    await cashRadio.click()

    const sellResponsePromise = page.waitForResponse(
      (r) =>
        r.url().includes("/dashboard/finance/package-purchases") &&
        r.request().method() === "POST" &&
        r.ok(),
      { timeout: 30_000 },
    );
    const sellSubmit = dialog.getByRole("button", { name: /بيع الباقة/ });
    await expect(sellSubmit).toBeEnabled({ timeout: 10_000 });
    await sellSubmit.click();
    const sellResponse = await sellResponsePromise;
    const sellPayload = (await sellResponse.json()) as {
      purchase?: { id: string };
    };
    if (sellPayload.purchase?.id) {
      harness.seededPurchaseId = sellPayload.purchase.id;
    }

    // Dialog closes after success; balances tab now has the row.
    await expect(dialog).toBeHidden({ timeout: 15_000 });
    // Switch to the أرصدة الباقات tab and verify the credit row.
    const balancesTab = page.getByRole("tab", { name: /أرصدة الباقات/ });
    await expect(balancesTab).toBeVisible({ timeout: 10_000 });
    await balancesTab.click()

    // The balances panel doesn't render an explicit heading — verify by the purchase card itself (package name + active status badge).
    await expect(
      page.getByText(new RegExp(harness.packageNameAr)).first(),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/نشطة/).first()).toBeVisible({
      timeout: 10_000,
    });

    // Credit row: data-testid="credit-book-button" with the per-credit remaining shown in the row. remaining/totalQuantity = 4/4 متبقية.
    const creditBookBtn = page.getByTestId("credit-book-button").first();
    await expect(creditBookBtn).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/4\s*\/\s*4\s*متبقية/)).toBeVisible({
      timeout: 10_000,
    });

    // Explicit-credit evidence: the issued credit row must display the
    // seeded service name, employee name, and duration label BEFORE we click
    // "احجز موعد". This proves the UI-created single-specific item was the
    // source of the credit (not a silent fixture PATCH). The `<li>` wraps
    // serviceName + "employeeName • durationLabel" + the book button.
    const creditRow = page
      .locator("li")
      .filter({ has: page.getByTestId("credit-book-button") })
      .filter({ hasText: harness.seededServiceNameAr })
      .first();
    await expect(creditRow).toBeVisible({ timeout: 10_000 });
    await expect(creditRow).toContainText(harness.seededServiceNameAr);
    await expect(creditRow).toContainText(harness.employeeName);
    await expect(creditRow).toContainText("جلسة");

    /* ── 3. Book from the credit via the "احجز موعد" dialog ─────────── */
    await creditBookBtn.click()

    const bookDialog = page.getByRole("dialog").filter({
      has: page.getByText(/احجز موعد من الرصيد/),
    });
    await expect(bookDialog).toBeVisible({ timeout: 10_000 });

    // Branch: pre-selected to the main branch via the form's effect; confirm the trigger is enabled.
    const bookBranchSelect = bookDialog.locator("#credit-book-branch");
    await expect(bookBranchSelect).toBeVisible({ timeout: 10_000 });

    // Date: open the DatePicker popover and click a future day. The trigger is a <button> with placeholder "اختر التاريخ".
    const dateTrigger = bookDialog
      .getByRole("button", { name: /اختر التاريخ/ })
      .first();
    await pickCreditBookDateCell(page, dateTrigger)

    // Time: HH:MM in a `type="time"` input. Assert the DOM value matches after fill() to surface a 4xx when the value silently didn't land (original hydration-race mask).
    const timeInput = bookDialog.locator('input[type="time"]');
    await expect(timeInput).toBeVisible({ timeout: 10_000 });
    await expect(timeInput).toBeEditable({ timeout: 10_000 });
    await timeInput.fill("10:30");
    await expect(timeInput).toHaveValue("10:30", { timeout: 5_000 });

    const bookSubmit = bookDialog.getByRole("button", { name: /تأكيد الموعد/ });
    await expect(bookSubmit).toBeEnabled({ timeout: 15_000 });

    // Capture the POST response regardless of 2xx/4xx so a backend validation failure surfaces immediately with the actual status + body instead of silently becoming a timeout.
    const bookResponsePromise = page.waitForResponse(
      (r) =>
        r.url().includes("/dashboard/bookings/from-credit") &&
        r.request().method() === "POST",
      { timeout: 30_000 },
    );
    await bookSubmit.click();
    const bookResponse = await bookResponsePromise;
    if (!bookResponse.ok()) {
      let failureBody: string
      try {
        failureBody = await bookResponse.text()
      } catch {
        failureBody = "(unreadable body)"
      }
      throw new Error(
        `[packages-lifecycle] book-from-credit POST failed — HTTP ${bookResponse.status}: ${failureBody}`,
      );
    }
    const booked = (await bookResponse.json()) as { id?: string };
    if (booked.id) harness.seededBookingId = booked.id;

    await expect(bookDialog).toBeHidden({ timeout: 15_000 });

    // Credit remaining decremented by 1 (3/4 متبقية).
    await expect(page.getByText(/3\s*\/\s*4\s*متبقية/)).toBeVisible({ timeout: 15_000 });

    /* ── 4. Cancel the booking via API → credit is returned ─────────── */
    if (harness.seededBookingId) {
      const cancelRes = await dashboardApiRequest(
        `/dashboard/bookings/${harness.seededBookingId}/cancel`,
        harness.token,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: "CLIENT_REQUESTED" }),
        },
      );
      expect(
        cancelRes.ok,
        `cancel booking HTTP ${cancelRes.status}: ${await cancelRes
          .text()
          .catch(() => "")}`,
      ).toBe(true);
    }

    // Reload the balances tab and assert remaining is back to 4/4.
    await page.reload({ waitUntil: "domcontentloaded" });
    // The balances tab is a TabsTrigger (role=tab), not a heading. Click it to make sure the balances panel renders the updated remaining.
    const balancesTab2 = page.getByRole("tab", { name: /أرصدة الباقات/ });
    await expect(balancesTab2).toBeVisible({ timeout: 20_000 });
    await balancesTab2.click();
    await expect(page.getByText(/4\s*\/\s*4\s*متبقية/)).toBeVisible({
      timeout: 15_000,
    });

    /* ── 5. Refund the package via the refund modal ──────────────────── */
    const refundBtn = page.getByTestId("package-refund-button").first();
    await expect(refundBtn).toBeVisible({ timeout: 10_000 });
    await refundBtn.click()

    const refundDialog = page.getByRole("dialog").filter({
      has: page.getByText(/استرداد الباقة/),
    });
    await expect(refundDialog).toBeVisible({ timeout: 10_000 });

    // Default refund amount == amountPaid. Submit straight away.
    const refundSubmit = refundDialog.getByRole("button", {
      name: /تأكيد الاسترداد/,
    });
    await expect(refundSubmit).toBeEnabled({ timeout: 10_000 });

    const refundResponsePromise = page.waitForResponse(
      (r) =>
        r.url().includes("/dashboard/finance/package-purchases/") &&
        r.url().includes("/refund") &&
        r.request().method() === "POST" &&
        r.ok(),
      { timeout: 30_000 },
    );
    await refundSubmit.click();
    await refundResponsePromise;

    await expect(refundDialog).toBeHidden({ timeout: 15_000 });

    // Status badge flips to REFUNDED → AR label "مستردة" appears on the purchase card. The balance tab reloads; wait for the status text.
    await expect(page.getByText(/مستردة/).first()).toBeVisible({
      timeout: 20_000,
    });

    // Defensive: the credit-book button should now be gone (REFUNDED purchases no longer expose the booking action, since the credits are voided).
    await expect(page.getByTestId("credit-book-button")).toHaveCount(0, {
      timeout: 10_000,
    });
  });
})
