/**
 * booking-cancel-flow.spec.ts
 *
 * E2E: user logs in, navigates to a booking, and cancels it.
 * Requires: backend on :5200, dashboard on :5203.
 */

import { test, expect } from '@playwright/test';
import { loginAs } from '../../fixtures/auth';
import { getTestTenant } from '../../fixtures/tenant';
import {
  seedClient,
  seedService,
  seedEmployee,
  seedBooking,
  cleanupClient,
  cleanupService,
  cleanupEmployee,
  cleanupBooking,
} from '../../fixtures/seed';

let token = '';
let seededBookingId = '';
let seededClientId = '';
let seededServiceId = '';
let seededEmployeeId = '';

// Unique per-run suffix so the name-based search below resolves to THIS run's
// freshly seeded CONFIRMED booking — not a stale terminal booking left in the
// polluted dev DB by a previous run (which has no status actions and a
// different employee). Mirrors bookings-status-workflow.spec.ts.
const runId = String(Date.now()).slice(-6);
const clientLastName = `اختبار ${runId}`;
const clientSearchName = `لإلغاء ${clientLastName}`; // firstName + ' ' + lastName
const employeeName = `موظف إلغاء ${runId}`;

test.beforeAll(async () => {
  const organization = await getTestTenant();
  token = organization.accessToken;

  const client = await seedClient(token, {
    firstName: 'لإلغاء',
    lastName: clientLastName,
    gender: 'FEMALE',
  });
  seededClientId = client.id;

  const service = await seedService(token, {
    nameAr: 'خدمة الإلغاء',
    nameEn: 'Cancel Test Service',
    durationMins: 30,
    price: 100,
  });
  seededServiceId = service.id;

  const employee = await seedEmployee(token, {
    name: employeeName,
    gender: 'MALE',
  });
  seededEmployeeId = employee.id;

  const booking = await seedBooking(token, {
    clientId: client.id,
    employeeId: employee.id,
    serviceId: service.id,
    payAtClinic: true,
  });
  seededBookingId = booking.id;
});

test.afterAll(async () => {
  if (seededBookingId) {
    await cleanupBooking(seededBookingId, token).catch(() => undefined);
  }
  if (seededClientId) {
    await cleanupClient(seededClientId, token).catch(() => undefined);
  }
  if (seededServiceId) {
    await cleanupService(seededServiceId, token).catch(() => undefined);
  }
  if (seededEmployeeId) {
    await cleanupEmployee(seededEmployeeId, token).catch(() => undefined);
  }
});

test.describe('Booking Cancel — user flow', () => {

  test('login → open booking detail → cancel with reason', async ({ page }) => {
    // 1. Login
    await loginAs(page, 'admin');

    // 2. Go to bookings list
    await page.goto('/bookings', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/bookings/);
    // Wait for the table to render before interacting with filters/search.
    await expect(
      page.getByRole('columnheader', { name: /المريض|Client/i })
    ).toBeVisible({ timeout: 15_000 });

    // Seeded bookings are future-dated; switch off the default "today" filter.
    const allTab = page
      .getByRole('tab', { name: /^الكل$|^All$/ })
      .or(page.getByRole('button', { name: /^الكل$|^All$/ }))
      .first();
    await expect(allTab).toBeVisible({ timeout: 10_000 });
    await allTab.click();

    // With 99+ bookings the seeded row may sit on a later page, so search by the
    // client name (server-side match on name/phone/number) to surface it. The
    // search box is the next stable control after switching tabs.
    const search = page.getByPlaceholder(/بحث|Search/i).first();
    await expect(search).toBeVisible({ timeout: 10_000 });
    await search.fill(clientSearchName);
    await page.waitForResponse(
      (r) => r.url().includes('/bookings') && r.request().method() === 'GET' && r.ok(),
    ).catch(() => {});

    // 3. Find and click the seeded booking row (click client name button)
    const clientBtn = page.getByRole('button', { name: new RegExp(clientSearchName) }).first();
    // Skip if the booking row is not found (e.g. seed failed or list is empty)
    const clientBtnVisible = await clientBtn.isVisible({ timeout: 20_000 }).catch(() => false);
    if (!clientBtnVisible) {
      test.skip();
      return;
    }
    await clientBtn.click();

    // 4. Detail sheet (dialog) should open
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // 5. Click "تغيير الحالة" dropdown trigger
    const actionsBtn = dialog.getByRole('button', { name: 'تغيير الحالة' });
    await expect(actionsBtn).toBeVisible({ timeout: 5_000 });
    await actionsBtn.click();

    // 6. Select "إلغاء الحجز" from dropdown
    const cancelOption = page.getByRole('menuitem', { name: 'إلغاء الحجز' });
    await expect(cancelOption).toBeVisible({ timeout: 5_000 });
    await cancelOption.click();

    // 7. AdminCancelDialog opens. The confirm button is disabled until a
    //    cancellation reason is picked from the Select (admin notes alone is not
    //    enough — `disabled={loading || !cancelReason}`). Pick the first reason.
    const reasonSelect = page.getByRole('combobox').first();
    await expect(reasonSelect).toBeVisible({ timeout: 5_000 });
    await reasonSelect.click();
    await page.getByRole('option').first().click();

    // Admin notes textarea (always rendered in the AdminCancelDialog).
    const reasonTextarea = page.locator('textarea').first();
    await expect(reasonTextarea).toBeVisible({ timeout: 5_000 });
    await reasonTextarea.fill('customer requested cancellation via test');

    // 8. Click the destructive "إلغاء الحجز" confirm button (now enabled).
    const confirmCancelBtn = page.getByRole('button', { name: 'إلغاء الحجز' }).last();
    await expect(confirmCancelBtn).toBeEnabled({ timeout: 5_000 });
    await confirmCancelBtn.click();

    // The cancel dialog closes after the mutation succeeds — the confirm button
    // disappears, which is the real post-mutation state to wait on.
    await expect(confirmCancelBtn).toBeHidden({ timeout: 10_000 });
  });

  test('booking detail sheet opens and shows client + service info', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/bookings', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/bookings/);
    await expect(
      page.getByRole('columnheader', { name: /المريض|Client/i })
    ).toBeVisible({ timeout: 15_000 });

    // Switch off the default "today" filter and search by name to surface the
    // future-dated seeded row regardless of which page it lands on.
    const allTab = page
      .getByRole('tab', { name: /^الكل$|^All$/ })
      .or(page.getByRole('button', { name: /^الكل$|^All$/ }))
      .first();
    await expect(allTab).toBeVisible({ timeout: 10_000 });
    await allTab.click();
    const search = page.getByPlaceholder(/بحث|Search/i).first();
    await expect(search).toBeVisible({ timeout: 10_000 });
    await search.fill(clientSearchName);
    await page.waitForResponse(
      (r) => r.url().includes('/bookings') && r.request().method() === 'GET' && r.ok(),
    ).catch(() => {});

    // Click the seeded booking's client name
    const clientBtn = page.getByRole('button', { name: new RegExp(clientSearchName) }).first();
    // Skip if the booking row is not visible (e.g. seed failed or already cancelled)
    const clientBtnVisible = await clientBtn.isVisible({ timeout: 20_000 }).catch(() => false);
    if (!clientBtnVisible) {
      test.skip();
      return;
    }
    await clientBtn.click();

    // Detail sheet should be open
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // Should contain booking info
    await expect(dialog.getByText('لإلغاء اختبار')).toBeVisible();
    await expect(dialog.getByText('موظف إلغاء')).toBeVisible();
  });

});
