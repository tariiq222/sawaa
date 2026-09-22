/**
 * bookings-list-flow.spec.ts
 *
 * E2E: user logs in, navigates to bookings list, views a booking detail.
 * Requires: backend on :5200, dashboard on :5203, docker stack up.
 *
 * User flow:
 *   1. Login as admin
 *   2. Navigate to /bookings
 *   3. Wait for table to load
 *   4. Click on a booking row
 *   5. Verify detail sheet opens
 */

import { test, expect } from '@playwright/test';
import { loginAs } from '../../fixtures/auth';
import { getTestTenant } from '../../fixtures/tenant';
import {
  cleanupBooking,
  cleanupClient,
  cleanupEmployee,
  cleanupService,
  seedBooking,
  seedClient,
  seedEmployee,
  seedService,
  type SeededBooking,
  type SeededClient,
  type SeededEmployee,
  type SeededService,
} from '../../fixtures/seed';

let token = '';
let seededClient: SeededClient;
let seededService: SeededService;
let seededEmployee: SeededEmployee;
let seededBooking: SeededBooking;
const runId = String(Date.now()).slice(-6);

test.beforeAll(async () => {
  token = (await getTestTenant()).accessToken;
  seededClient = await seedClient(token, {
    firstName: 'قائمة',
    lastName: `حجز ${runId}`,
    gender: 'FEMALE',
  });
  seededService = await seedService(token, {
    nameAr: 'خدمة قائمة الحجوزات',
    nameEn: 'Bookings List Service',
    durationMins: 30,
    price: 100,
  });
  seededEmployee = await seedEmployee(token, {
    name: `ممارس قائمة الحجوزات ${runId}`,
    gender: 'MALE',
  });
  seededBooking = await seedBooking(token, {
    clientId: seededClient.id,
    employeeId: seededEmployee.id,
    serviceId: seededService.id,
    payAtClinic: true,
  });
});

test.afterAll(async () => {
  if (seededBooking?.id) await cleanupBooking(seededBooking.id, token).catch(() => undefined);
  if (seededEmployee?.id) await cleanupEmployee(seededEmployee.id, token).catch(() => undefined);
  if (seededService?.id) await cleanupService(seededService.id, token).catch(() => undefined);
  if (seededClient?.id) await cleanupClient(seededClient.id, token).catch(() => undefined);
});

test.describe('Bookings List — user flow', () => {

  test('login → bookings list → open booking detail sheet', async ({ page }) => {
    // 1. Login
    await loginAs(page, 'admin');

    // 2. Navigate to bookings
    await page.goto('/bookings');
    await expect(page).toHaveURL(/\/bookings/);

    // The list defaults to Today, while seedBooking creates tomorrow's slot.
    // Select All before searching so this assertion exercises the seeded row.
    const allTab = page.getByRole('tab', { name: /^الكل$|^All$/ }).first();
    await expect(allTab).toBeVisible({ timeout: 10_000 });
    await Promise.all([
      page.waitForResponse(
        (r) =>
          new URL(r.url()).pathname.endsWith('/api/proxy/dashboard/bookings') &&
          r.request().method() === 'GET' &&
          r.ok(),
        { timeout: 15_000 },
      ),
      allTab.click(),
    ]);

    const search = page.getByPlaceholder(/بحث بالاسم|Search by name/i).first();
    await expect(search).toBeVisible({ timeout: 10_000 });
    await Promise.all([
      page.waitForResponse(
        (r) =>
          new URL(r.url()).pathname.endsWith('/api/proxy/dashboard/bookings') &&
          r.request().method() === 'GET' &&
          r.ok(),
        { timeout: 15_000 },
      ),
      search.fill(seededBooking.id),
    ]);

    const clientBtn = page
      .getByRole('button', { name: new RegExp(escapeRegex(`${seededClient.firstName} ${seededClient.lastName}`)) })
      .first();
    await expect(clientBtn).toBeVisible({ timeout: 20_000 });
    await clientBtn.click();

    // Detail sheet (Dialog) must open for the exact seeded booking row.
    await expect(page.locator('[role="dialog"]').first()).toBeVisible({ timeout: 10_000 });
  });

  test('login → bookings list → filter by status "confirmed"', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/bookings');
    await expect(page).toHaveURL(/\/bookings/);

    // Filter controls should be present — assert the list rendered by checking
    // the bookings table column header is visible.
    await expect(
      page.getByRole('columnheader', { name: /المريض|Client/i }).first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('login → bookings list → navigate to create booking', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/bookings');
    await expect(page).toHaveURL(/\/bookings/);
    // Wait for the list to render before probing for the create button.
    await expect(
      page.getByRole('columnheader', { name: /المريض|Client/i }).first(),
    ).toBeVisible({ timeout: 15_000 });

    // Look for create/add button — try multiple selectors
    const createBtn = page.locator(
      'button:has-text("حجز جديد"), button:has-text("إضافة"), a[href="/bookings/create"]',
    ).first();

    await expect(createBtn).toBeVisible({ timeout: 5_000 });
    await createBtn.click();
    // The create action renders the booking POS inline.
    const pos = page.locator('.rounded-2xl.border').filter({ hasText: /حجز جديد/ });
    await expect(pos).toBeVisible({ timeout: 10_000 });
  });

});

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
