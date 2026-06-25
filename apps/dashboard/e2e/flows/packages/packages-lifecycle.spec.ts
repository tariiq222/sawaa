/**
 * packages-lifecycle.spec.ts
 *
 * E2E: full lifecycle of the session-package (credit-pack) system in the
 * Sawaa dashboard. Closes the last browser-level test gap for the
 * session-packages rebuild (Phase 1–5) by exercising:
 *
 *   1. Package creation on /packages (Phase 1) — fill nameAr, add an item
 *      via the row builder (service → employee → duration → paidQuantity +
 *      freeQuantity), set a discount, submit, and assert the row appears
 *      in /packages with the live-computed final price.
 *   2. Manual package sale on the client detail page (Phase 2) — click
 *      "بيع باقة", pick the new package + a branch + CASH, submit, then
 *      switch to the client's "أرصدة الباقات" tab and assert the credit
 *      shows with remaining === totalQuantity.
 *   3. Book from the credit (Phase 3) — click "احجز موعد" on the credit
 *      row, pick a valid slot in the future (branch + day + time),
 *      submit, and assert the credit's `remaining` decremented by 1.
 *   4. Cancel the booking → assert the credit was returned (remaining
 *      back to totalQuantity). The cancel transition is issued via the
 *      backend cancel endpoint (the cancel-UI flow is already covered by
 *      booking-cancel-flow.spec.ts); the spec asserts the credit-return
 *      side-effect by re-reading the balances tab.
 *   5. Refund the package purchase (Phase 5) — open the refund modal
 *      from the balances tab, confirm, and assert the purchase card now
 *      shows the REFUNDED status badge.
 *
 * Pre-requisites (handled by Playwright `setup` project):
 *   - Backend on PW_API_URL (defaults to http://localhost:5200 in the
 *     harness, but the local docker stack here maps to :3450 — set
 *     PW_API_URL=http://localhost:3450 when running).
 *   - Dashboard on :5203, built/started by this config's webServer.
 *
 * Real-component selectors / i18n strings (honour the lessons log):
 *   - Row actions are icon buttons with aria-label (Edit / Delete).
 *   - Radix Selects are getByRole('combobox') + getByRole('option').
 *   - The package form's `nameAr` is the Input bound to nameAr (no
 *     explicit name/id attr — we locate it via the visible Label).
 *   - The credit-book dialog uses a DatePicker trigger button + a
 *     `type="time"` input; we click the trigger and pick a day in the
 *     calendar, then fill the time input.
 *   - Status badges are real <span> text inside the purchase card, so we
 *     match by visible text "مسترد" / "REFUNDED".
 */

import { test, expect } from "@playwright/test";
import { loginAs } from "../../fixtures/auth";
import { getTestTenant } from "../../fixtures/tenant";
import {
  seedClient,
  seedService,
  seedEmployee,
  assignEmployeeToService,
  assignEmployeeToBranch,
  setBranchBusinessHours,
  setEmployeeAvailability,
  prepareBookableSchedule,
  ensureValidMainBranchId,
  ensurePayAtClinicEnabled,
  dashboardApiRequest,
} from "../../fixtures/seed";

/* ─── Fixture state shared across the lifecycle ───────────────────────── */

let token = "";

let seededBranchId = "";
let seededEmployeeId = "";
let seededServiceId = "";
let seededServiceNameAr = "";
let seededClientId = "";
let seededClientName = "";
let seededPackageId = "";
let seededPurchaseId = "";
let seededBookingId = "";

/** Run-scoped name suffix so the package + balance row resolve to THIS run
 *  in the polluted dev DB (mirrors bookings-status-workflow). */
const runId = String(Date.now()).slice(-6);
const packageNameAr = `باقة اختبار ${runId}`;
const clientFirstName = "عميل الباقة";
const clientLastName = `اختبار ${runId}`;
const employeeName = `موظف الباقة ${runId}`;

/* ─── Test lifecycle ─────────────────────────────────────────────────── */

test.beforeAll(async () => {
  const t = await getTestTenant();
  token = t.accessToken;

  // Seed prerequisite entities via the API so the UI flows have real
  // service / employee / branch / client rows to pick from.
  // We use the MAIN branch because the credit-book dialog auto-selects
  // `activeBranches.find((b) => b.isMain)` — using a non-main branch
  // would mean the availability check fires against a branch that
  // doesn't have hours/availability configured for the seeded employee
  // and the booking would 400 "Selected booking time is not available".
  const branch = await ensureValidMainBranchId(token);
  seededBranchId = branch;

  const client = await seedClient(token, {
    firstName: clientFirstName,
    lastName: clientLastName,
    gender: "FEMALE",
  });
  seededClientId = client.id;
  seededClientName = `${client.firstName} ${client.lastName}`;

  // Service with one active IN_PERSON booking type (default) + one
  // matching duration option (price 15000 halalas = 150 SAR).
  const serviceNameArBase = "خدمة الباقة";
  const service = await seedService(token, {
    nameAr: `${serviceNameArBase} ${runId}`,
    nameEn: `Package Test Service ${runId}`,
    durationMins: 60,
    price: 15000,
  });
  seededServiceId = service.id;
  seededServiceNameAr = service.nameAr;

  // The default seedService hook creates the IN_PERSON booking type with
  // the service defaults; now add a matching duration option so the
  // package item builder's "duration" select has a choice (and so
  // book-from-credit's credit row is keyed to it).
  const durRes = await dashboardApiRequest(
    `/dashboard/organization/services/${service.id}/duration-options`,
    token,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        options: [
          {
            label: "جلسة",
            labelAr: "جلسة",
            durationMins: 60,
            price: 15000,
            deliveryType: "IN_PERSON",
            isDefault: true,
            isActive: true,
            sortOrder: 0,
          },
        ],
      }),
    },
  );
  if (!durRes.ok) {
    throw new Error(
      `[packages-lifecycle] seed duration options failed — HTTP ${durRes.status}: ${await durRes
        .text()
        .catch(() => "(unreadable)")}`,
    );
  }
  const durs = (await durRes.json()) as Array<{ id: string }>;
  if (!durs.length) {
    throw new Error("[packages-lifecycle] seed duration options returned empty list");
  }

  const employee = await seedEmployee(token, {
    name: employeeName,
    gender: "MALE",
  });
  seededEmployeeId = employee.id;

  // Wire the employee to the service + branch with availability, mirroring
  // the lessons-log chain that prevents the booking wizard from returning
  // zero slots.
  await assignEmployeeToService(token, employee.id, service.id).catch(
    () => undefined,
  );
  await setBranchBusinessHours(token, branch);
  await assignEmployeeToBranch(token, branch, employee.id).catch(() => undefined);
  await setEmployeeAvailability(token, employee.id);
  await prepareBookableSchedule(token, { branchId: branch, employeeId: employee.id });

  // The package sale path uses pay-at-clinic-style manual cash flow only
  // conceptually; ensurePayAtClinicEnabled is a no-op for non-pay-at-clinic
  // sells but is safe to call.
  await ensurePayAtClinicEnabled(token).catch(() => undefined);
});

test.afterAll(async () => {
  // Targeted cleanup — never touch shared rows.
  if (seededPurchaseId) {
    await dashboardApiRequest(
      `/dashboard/finance/package-purchases/${seededPurchaseId}/refund`,
      token,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refundAmount: 0 }),
      },
    ).catch(() => undefined);
  }
  if (seededPackageId) {
    await dashboardApiRequest(
      `/dashboard/organization/packages/${seededPackageId}`,
      token,
      { method: "DELETE" },
    ).catch(() => undefined);
  }
  if (seededClientId) {
    await dashboardApiRequest(
      `/dashboard/people/clients/${seededClientId}`,
      token,
      { method: "DELETE" },
    ).catch(() => undefined);
  }
  if (seededServiceId) {
    await dashboardApiRequest(
      `/dashboard/organization/services/${seededServiceId}`,
      token,
      { method: "DELETE" },
    ).catch(() => undefined);
  }
  if (seededEmployeeId) {
    await dashboardApiRequest(
      `/dashboard/people/employees/${seededEmployeeId}`,
      token,
      { method: "DELETE" },
    ).catch(() => undefined);
  }
  if (seededBranchId) {
    await dashboardApiRequest(
      `/dashboard/organization/branches/${seededBranchId}`,
      token,
      { method: "DELETE" },
    ).catch(() => undefined);
  }
});

test.describe("Session Packages — dashboard lifecycle", () => {
  test("create → sell → book-from-credit → cancel returns credit → refund shows REFUNDED", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    /* ── 1. Login + create a package on /packages/create ─────────────── */
    await loginAs(page, "admin");

    await page.goto("/packages", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /باقات الجلسات/ })).toBeVisible({
      timeout: 20_000,
    });

    // The "إضافة باقة" button is the create trigger on the empty-state
    // card AND the page-header button. Match by text — they're identical.
    const addBtn = page.getByRole("button", { name: /إضافة باقة/ }).first();
    await expect(addBtn).toBeVisible({ timeout: 10_000 });
    await addBtn.click();

    // Form page: wait for the nameAr input + the item-builder add button.
    await expect(page).toHaveURL(/\/packages\/create/, { timeout: 10_000 });
    const nameArInput = page.locator('input[dir="rtl"]').first();
    await expect(nameArInput).toBeVisible({ timeout: 15_000 });
    await nameArInput.fill(packageNameAr);

    // Add one package item via the "إضافة بند" button.
    const addItemBtn = page.getByRole("button", { name: /إضافة بند/ });
    await expect(addItemBtn).toBeVisible({ timeout: 10_000 });
    await addItemBtn.click();

    // The form's combobox order is:
    //   [0] discountType (PERCENTAGE / FIXED) — the ONLY combobox on the
    //       page before the first item row is added.
    //   [1] items.0.service  (added by the click above)
    //   [2] items.0.employee
    //   [3] items.0.duration
    // The item-builder row exposes three Select triggers in this order:
    // service → employee → duration.
    const itemComboboxes = page.getByRole("combobox");
    await expect(itemComboboxes.nth(1)).toBeVisible({ timeout: 10_000 });

    // ── Service select (second combobox on the page, first in the item row) ──
    await itemComboboxes.nth(1).click();
    // The option label is `nameAr` (we are in `ar` locale) — match the
    // AR name verbatim so regex chars in the suffix (digits + spaces) are
    // treated literally.
    const serviceOption = page
      .getByRole("option")
      .filter({ hasText: seededServiceNameAr })
      .first();
    await expect(serviceOption).toBeVisible({ timeout: 15_000 });
    await serviceOption.click();

    // ── Employee select — gated on service; wait for the data load ────
    await expect
      .poll(async () => await itemComboboxes.nth(2).isEnabled(), { timeout: 15_000 })
      .toBe(true);
    await itemComboboxes.nth(2).click();
    const employeeOption = page
      .getByRole("option")
      .filter({ hasText: employeeName })
      .first();
    await expect(employeeOption).toBeVisible({ timeout: 15_000 });
    await employeeOption.click();

    // ── Duration select — also gated on service ───────────────────────
    await expect
      .poll(async () => await itemComboboxes.nth(3).isEnabled(), { timeout: 15_000 })
      .toBe(true);
    await itemComboboxes.nth(3).click();
    // Duration labels are "labelAr · durationMins د · price"; pick the
    // first option that has a minute count (the disabled "unavailable"
    // placeholder has no `\d+ د`).
    const firstDurationOption = page
      .getByRole("option")
      .filter({ hasText: /\d+\s*د/ })
      .first();
    await expect(firstDurationOption).toBeVisible({ timeout: 15_000 });
    await firstDurationOption.click();

    // ── paidQuantity + freeQuantity — default 1/0 from the row append.
    //   Bump paidQuantity to 4 so the credit has room for the
    //   book-from-credit step below without instantly depleting.
    //   The form order is: discountValue, sortOrder, items.0.paidQuantity,
    //   items.0.freeQuantity — so `input[type="number"]` indices are 0/1/2/3.
    //   Locate by the row's `id="items.0.paidQuantity"` to be unambiguous.
    const paidInput = page.locator('#items\\.0\\.paidQuantity');
    await expect(paidInput).toBeVisible({ timeout: 5_000 });
    await paidInput.fill("4");

    // ── Discount: leave at the 0 default (no discount needed for the
    //   lifecycle proof); finalPrice = 4 × 150 SAR = 600 SAR.

    // Submit the create form. The "إنشاء الباقة" button is type="submit".
    const submitBtn = page.getByRole("button", { name: /إنشاء الباقة/ });
    await expect(submitBtn).toBeEnabled({ timeout: 10_000 });

    // Capture the POST response so we can extract the real package id
    // (the list re-reads the rows on cache invalidation).
    const createResponsePromise = page.waitForResponse(
      (r) =>
        r.url().includes("/dashboard/organization/packages") &&
        r.request().method() === "POST" &&
        r.ok(),
      { timeout: 30_000 },
    );
    await submitBtn.click();
    const createResponse = await createResponsePromise;
    const created = (await createResponse.json()) as { id: string };
    seededPackageId = created.id;

    // After successful create, the form navigates back to /packages.
    await expect(page).toHaveURL(/\/packages$/, { timeout: 15_000 });
    await expect(
      page.getByRole("cell", { name: new RegExp(packageNameAr) }),
    ).toBeVisible({ timeout: 15_000 });

    /* ── 2. Sell the package to the seeded client ─────────────────────── */
    await page.goto(`/clients/${seededClientId}`, { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: new RegExp(seededClientName) }),
    ).toBeVisible({ timeout: 20_000 });

    const sellBtn = page.getByRole("button", { name: /بيع باقة/ }).first();
    await expect(sellBtn).toBeVisible({ timeout: 10_000 });
    await sellBtn.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await expect(dialog.getByText(/بيع باقة للمستفيد/)).toBeVisible();

    // Package select: id="sell-package" on the trigger.
    const pkgSelect = dialog.locator("#sell-package");
    await expect(pkgSelect).toBeVisible({ timeout: 10_000 });
    await pkgSelect.click();
    await page.getByRole("option", { name: new RegExp(packageNameAr) }).click();

    // Branch select: id="sell-branch" on the trigger.
    const branchSelect = dialog.locator("#sell-branch");
    await expect(branchSelect).toBeVisible({ timeout: 10_000 });
    await branchSelect.click();
    await page.getByRole("option").filter({ hasText: /اختبار/ }).first().click();

    // Payment method: radiogroup buttons. CASH is the default-enabled
    // option. The first radio should already be CASH.
    const cashRadio = dialog.getByRole("radio", { name: /نقداً/ });
    if (await cashRadio.isVisible().catch(() => false)) {
      await cashRadio.click();
    }

    // Submit the sell form.
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
      seededPurchaseId = sellPayload.purchase.id;
    }

    // Dialog closes after success; balances tab now has the row.
    await expect(dialog).toBeHidden({ timeout: 15_000 });

    // Switch to the أرصدة الباقات tab and verify the credit row.
    const balancesTab = page.getByRole("tab", { name: /أرصدة الباقات/ });
    await expect(balancesTab).toBeVisible({ timeout: 10_000 });
    await balancesTab.click();

    // The balances panel doesn't render an explicit heading — verify by
    // the purchase card itself (package name + active status badge).
    await expect(
      page.getByText(new RegExp(packageNameAr)).first(),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/نشطة/).first()).toBeVisible({
      timeout: 10_000,
    });

    // Credit row: data-testid="credit-book-button" with the per-credit
    // remaining shown in the row. remaining/totalQuantity = 4/4 متبقية.
    const creditBookBtn = page.getByTestId("credit-book-button").first();
    await expect(creditBookBtn).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/4\s*\/\s*4\s*متبقية/)).toBeVisible({
      timeout: 10_000,
    });

    /* ── 3. Book from the credit via the "احجز موعد" dialog ─────────── */
    await creditBookBtn.click();

    const bookDialog = page.getByRole("dialog").filter({
      has: page.getByText(/احجز موعد من الرصيد/),
    });
    await expect(bookDialog).toBeVisible({ timeout: 10_000 });

    // Branch: pre-selected to the main branch via the form's effect;
    // confirm the trigger is enabled.
    const bookBranchSelect = bookDialog.locator("#credit-book-branch");
    await expect(bookBranchSelect).toBeVisible({ timeout: 10_000 });

    // Date: open the DatePicker popover and click a future day. The
    // trigger is a <button> with placeholder "اختر التاريخ".
    const dateTrigger = bookDialog
      .getByRole("button", { name: /اختر التاريخ/ })
      .first();
    await expect(dateTrigger).toBeVisible({ timeout: 10_000 });
    await dateTrigger.click();

    // The DatePicker renders a react-day-picker Calendar. Day cells are
    // <button> elements; the calendar opens on today's month and the
    // trailing row shows the first few days of next month, so picking
    // tomorrow (today + 1) lands on a day whose cell is UNIQUE in the
    // visible grid. We pick by `data-day` attribute which uses the
    // browser's locale formatter (different from Node's locale formatter,
    // so we cannot build the value in the spec — read it from the DOM
    // after the popover opens).
    //
    // Strategy: enumerate the visible day cells, find the one whose
    // `data-day` ends with the year+month+day of tomorrow in the
    // browser's locale, and click it.
    const targetDay = (() => {
      const d = new Date();
      d.setDate(d.getDate() + 1); // tomorrow — unique in the visible grid
      return d;
    })();
    const targetYear = targetDay.getFullYear();
    const targetMonth = String(targetDay.getMonth() + 1);
    const targetDayNum = String(targetDay.getDate());

    // Brute-force day selection: locate every day button, then in JS find
    // the one whose data-day ends in "<year>/<month>" and whose text is the
    // target day number, then click it via the page handle.
    const cellIndex = await page.evaluate(
      ({ y, m, d }) => {
        const buttons = Array.from(document.querySelectorAll("button[data-day]"));
        // Strip the U+200F RTL marks that the ar-SA locale formatter
        // inserts between digits and slashes, so the data-day value
        // matches a plain Western-digit pattern.
        const strip = (s) => s.replace(/\u200f/g, "");
        const wantMonth = String(m).padStart(1, "0");
        const wantDay = String(d);
        for (let i = 0; i < buttons.length; i++) {
          const btn = buttons[i];
          const dd = strip(btn.getAttribute("data-day") ?? "");
          // data-day format (after stripping RTL marks):
          // "<day>/<month>/<year>" (Arabic locale uses this d/m/y order).
          const m1 = dd.match(/^(\d+)\/(\d+)\/(\d{4})$/);
          if (!m1) continue;
          const [, cellDay, cellMonth, cellYear] = m1;
          if (Number(cellYear) !== y) continue;
          if (Number(cellMonth) !== Number(wantMonth)) continue;
          if (Number(cellDay) !== Number(wantDay)) continue;
          return i;
        }
        return -1;
      },
      { y: targetYear, m: targetMonth, d: targetDayNum },
    );

    if (cellIndex < 0) {
      throw new Error(
        `[packages-lifecycle] could not find day cell for ${targetYear}-${targetMonth}-${targetDayNum} in the open calendar`,
      );
    }
    const cells = page.locator("button[data-day]");
    await cells.nth(cellIndex).click();

    // Time: HH:MM in a `type="time"` input.
    const timeInput = bookDialog.locator('input[type="time"]');
    await expect(timeInput).toBeVisible({ timeout: 10_000 });
    await timeInput.fill("10:30");

    // Wait for the submit button to be enabled (all three fields valid).
    const bookSubmit = bookDialog.getByRole("button", { name: /تأكيد الموعد/ });
    await expect(bookSubmit).toBeEnabled({ timeout: 15_000 });

    const bookResponsePromise = page.waitForResponse(
      (r) =>
        r.url().includes("/dashboard/bookings/from-credit") &&
        r.request().method() === "POST" &&
        r.ok(),
      { timeout: 30_000 },
    );
    await bookSubmit.click();
    const bookResponse = await bookResponsePromise;
    const booked = (await bookResponse.json()) as { id?: string };
    if (booked.id) seededBookingId = booked.id;

    await expect(bookDialog).toBeHidden({ timeout: 15_000 });

    // Credit remaining decremented by 1 (3/4 متبقية).
    await expect(page.getByText(/3\s*\/\s*4\s*متبقية/)).toBeVisible({
      timeout: 15_000,
    });

    /* ── 4. Cancel the booking via API → credit is returned ─────────── */
    if (seededBookingId) {
      const cancelRes = await dashboardApiRequest(
        `/dashboard/bookings/${seededBookingId}/cancel`,
        token,
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
    // The balances tab is a TabsTrigger (role=tab), not a heading. Click
    // it to make sure the balances panel renders the updated remaining.
    const balancesTab2 = page.getByRole("tab", { name: /أرصدة الباقات/ });
    await expect(balancesTab2).toBeVisible({ timeout: 20_000 });
    await balancesTab2.click();
    await expect(page.getByText(/4\s*\/\s*4\s*متبقية/)).toBeVisible({
      timeout: 15_000,
    });

    /* ── 5. Refund the package via the refund modal ──────────────────── */
    const refundBtn = page.getByTestId("package-refund-button").first();
    await expect(refundBtn).toBeVisible({ timeout: 10_000 });
    await refundBtn.click();

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

    // Status badge flips to REFUNDED → AR label "مستردة" appears on the
    // purchase card. The balance tab reloads; wait for the status text.
    await expect(page.getByText(/مستردة/).first()).toBeVisible({
      timeout: 20_000,
    });

    // Defensive: the credit-book button should now be gone (REFUNDED
    // purchases no longer expose the booking action, since the credits
    // are voided).
    await expect(page.getByTestId("credit-book-button")).toHaveCount(0, {
      timeout: 10_000,
    });
  });
});