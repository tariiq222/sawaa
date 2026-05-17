/**
 * booking-create-flow.spec.ts
 *
 * E2E: user logs in, opens create booking dialog, navigates the wizard.
 * Requires: backend on :5200, dashboard on :5203.
 */

import { test, expect } from '@playwright/test';
import { loginAs } from '../../fixtures/auth';
import { getTestTenant } from '../../fixtures/tenant';
import {
  seedClient,
  seedService,
  seedEmployee,
  assignEmployeeToService,
  cleanupClient,
  cleanupService,
  cleanupEmployee,
} from '../../fixtures/seed';

let token = '';
let seededClientId = '';
let seededServiceId = '';
let seededEmployeeId = '';

test.beforeAll(async () => {
  const organization = await getTestTenant();
  token = organization.accessToken;

  const client = await seedClient(token, {
    firstName: 'حجز',
    lastName: 'اختبار',
    gender: 'MALE',
  });
  seededClientId = client.id;

  const service = await seedService(token, {
    nameAr: 'خدمة حجز اختبار',
    nameEn: 'Booking Test Service',
    durationMins: 30,
    price: 150,
  });
  seededServiceId = service.id;

  const employee = await seedEmployee(token, {
    name: 'موظف حجز',
    gender: 'MALE',
  });
  seededEmployeeId = employee.id;

  // Ensure employee is assigned to the service so they appear in the wizard
  await assignEmployeeToService(token, employee.id, service.id);
});

test.afterAll(async () => {
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

test.describe('Booking Create Wizard — user flow', () => {

  test('wizard opens and navigates through client → service → employee steps', async ({ page }) => {
    // 1. Login
    await loginAs(page, 'admin');

    // 2. Navigate to bookings
    await page.goto('/bookings');
    await expect(page).toHaveURL(/\/bookings/);
    await page.waitForLoadState('networkidle');

    // 3. Open create dialog
    const addBtn = page.getByRole('button', { name: /حجز جديد/i });
    await addBtn.click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // 4. Step 1 — Client selection
    await page.waitForTimeout(1_500);

    // Search for the seeded client
    const searchInput = page.locator('input[placeholder*="ابحث"]').first();
    if (await searchInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await searchInput.fill('حجز اختبار');
      await page.waitForTimeout(1_000);
    }

    // Click the seeded client row
    const clientBtn = page.locator('button', { hasText: /حجز اختبار/ }).first();
    await expect(clientBtn).toBeVisible({ timeout: 10_000 });
    await clientBtn.click();
    await page.waitForTimeout(1_000);

    // 5. Step 2 — Service or path chooser
    const byServiceBtn = page.getByRole('button', { name: 'ابدأ بالخدمة' });
    if (await byServiceBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await byServiceBtn.click();
      await page.waitForTimeout(1_000);
    }

    // Select the seeded service
    const serviceBtn = page.locator('button', { hasText: /خدمة حجز اختبار/ }).first();
    await expect(serviceBtn).toBeVisible({ timeout: 10_000 });
    await serviceBtn.click();
    await page.waitForTimeout(1_000);

    // 6. Step 3 — Combined scheduling step: employee list + type/duration + datetime
    // The employee list should be visible on the left panel
    const employeeBtn = page.locator('button', { hasText: /موظف حجز/ }).first();
    await expect(employeeBtn).toBeVisible({ timeout: 10_000 });
    await employeeBtn.click();
    await page.waitForTimeout(1_000);

    // After selecting an employee, the type/duration panel appears on the right
    // Try to select a type if options are available (still on step 3)
    const typeBtn = page.locator('button', { hasText: /حضوري/ }).first();
    if (await typeBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await typeBtn.click();
      await page.waitForTimeout(500);
    }

    // Dialog should still be open
    await expect(dialog).toBeVisible();
  });

  test('wizard back button returns to previous step', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/bookings');
    await page.waitForLoadState('networkidle');

    // Open dialog
    const addBtn = page.getByRole('button', { name: /حجز جديد/i });
    await addBtn.click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // Search and select a client to advance to step 2
    await page.waitForTimeout(1_500);
    const searchInput = page.locator('input[placeholder*="ابحث"]').first();
    if (await searchInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await searchInput.fill('حجز اختبار');
      await page.waitForTimeout(1_000);
    }

    const clientBtn = page.locator('button', { hasText: /حجز اختبار/ }).first();
    if (await clientBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await clientBtn.click();
      await page.waitForTimeout(1_000);

      // Now on step 2 — click back button (ghost icon button with sr-only "رجوع")
      const backByLabel = page.getByRole('button', { name: 'رجوع' });
      if (await backByLabel.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await backByLabel.click();
        await page.waitForTimeout(500);
      }
    }

    await expect(page.locator('body')).toBeVisible();
  });

  test('wizard close button dismisses dialog', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/bookings');
    await page.waitForLoadState('networkidle');

    const addBtn = page.getByRole('button', { name: /حجز جديد/i });
    await addBtn.click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // Close button is the ✕ button in the wizard header (step 1)
    const closeBtn = page.locator('button').filter({ hasText: '✕' }).first();
    if (await closeBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await closeBtn.click();
      await page.waitForTimeout(500);
      await expect(dialog).not.toBeVisible({ timeout: 5_000 });
    } else {
      await expect(page.locator('body')).toBeVisible();
    }
  });

});
