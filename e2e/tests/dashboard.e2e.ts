import { test } from '@e2e-dev/web';
import { credentials, expect } from 'e2e';
import { dashboardUrl, isTarget } from '../urls.ts';

// Run with: pnpm e2e:ta-dashboard  (target "dashboard")
test('dashboard login page renders', { tags: ['smoke', 'dashboard'] }, async ({ app, screen, browser }) => {
  test.skip(!isTarget(app.baseUrl, dashboardUrl), 'run with --target dashboard');
  await app.open('/login');
  await expect(browser).toHaveURL(/\/login/);
  await expect(screen.getByText(/مرحباً بعودتك|Welcome back/)).toBeVisible();
  await expect(screen.getByLabel(/البريد الإلكتروني أو رقم الجوال|Email or mobile number/)).toBeVisible();
});

// SW-D01: real identifier → method → password login; no API/session bypass.
// Requires a dedicated test staff account with booking:read and no forced OTP.
test('SW-D01 staff signs in and keeps access after reload', {
  tags: ['smoke', 'dashboard', 'auth'],
  skip: !process.env.E2E_USER_DASHBOARD_USERNAME || !process.env.E2E_USER_DASHBOARD_PASSWORD
    ? 'Dedicated test account required: E2E_USER_DASHBOARD_USERNAME and E2E_USER_DASHBOARD_PASSWORD'
    : false,
}, async ({ app, screen, browser }) => {
  test.skip(!isTarget(app.baseUrl, dashboardUrl), 'run with --target dashboard');
  const staff = credentials.user('dashboard');
  await app.open('/login');
  await screen.getByLabel(/البريد الإلكتروني أو رقم الجوال|Email or mobile number/).fill(staff.username);
  await screen.getByRole('button', /^(متابعة|Continue)$/).tap();
  await screen.getByRole('button', /^(باستخدام كلمة المرور|Use password)$/).tap();
  await screen.getByLabel(/^(كلمة المرور|Password)$/).fill(staff.password);
  await screen.getByRole('button', /^(تسجيل الدخول|Sign in)$/).tap();

  await expect(browser).toHaveURL('/');
  const bookingsButton = screen.getByRole('button', /^(الحجوزات|Bookings)$/, { visible: true });
  await expect(bookingsButton).toBeVisible({ timeout: 30_000 });
  await bookingsButton.tap();
  await expect(browser).toHaveURL('/bookings');
  await expect(screen.getByRole('heading', /^(الحجوزات|Bookings)$/)).toBeVisible({ timeout: 30_000 });

  await browser.reload();
  await expect(browser).toHaveURL('/bookings');
  await expect(screen.getByRole('heading', /^(الحجوزات|Bookings)$/)).toBeVisible({ timeout: 30_000 });
  await expect(bookingsButton).toBeVisible();

  // The header trigger has no stable accessible name; scope to its avatar.
  await browser.locator('header button').filter({
    has: browser.locator('[data-slot="avatar-fallback"]'),
  }).tap();
  await screen.getByRole('button', /^(تسجيل الخروج|Log out|Logout|Sign out)$/i).tap();
  await expect(screen.getByLabel(/البريد الإلكتروني أو رقم الجوال|Email or mobile number/)).toBeVisible();
  await app.open('/bookings');
  // AuthGate renders LoginForm in place, retaining the requested URL.
  await expect(screen.getByLabel(/البريد الإلكتروني أو رقم الجوال|Email or mobile number/)).toBeVisible();
  await expect(screen.getByRole('heading', /^(الحجوزات|Bookings)$/)).toHaveCount(0);
  await expect(bookingsButton).toHaveCount(0);
});
