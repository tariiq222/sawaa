import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { dashboardUrl, isTarget } from '../urls.ts';

// Run with: pnpm e2e:ta-dashboard  (target "dashboard")
test('dashboard login page renders', { tags: ['smoke', 'dashboard'] }, async ({ app, screen, browser }) => {
  test.skip(!isTarget(app.baseUrl, dashboardUrl), 'run with --target dashboard');
  await app.open('/login');
  await expect(browser).toHaveURL(/\/login/);
  await expect(screen.getByText(/مرحباً بعودتك|Welcome back/)).toBeVisible();
  await expect(screen.getByLabel(/البريد الإلكتروني أو رقم الجوال|Email or mobile number/)).toBeVisible();
});

// Implement the multi-step identifier → method → password/OTP flow and a
// positive signed-in assertion before enabling this test.
test('signed-in dashboard', {
  tags: ['dashboard', 'auth'],
  skip: 'Pending implementation: multi-step login and signed-in assertion',
}, async () => {});
