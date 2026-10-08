import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { isTarget, websiteUrl } from '../urls.ts';

// Run with: pnpm e2e:website  (target "website")
test('SW-W01 website home renders the Arabic hero', { tags: ['smoke', 'website'] }, async ({ app, screen }) => {
  test.skip(!isTarget(app.baseUrl, websiteUrl), 'run with --target website');
  await app.open('/');

  // Hero <h1> of apps/website/themes/sawaa/components/sections/hero.tsx
  await expect(screen.getByRole('heading', /تبدأ اليوم/, { level: 1 })).toBeVisible();
});

test('SW-W02 agent opens the clinic directory', { tags: ['website', 'agent', 'discovery'] }, async ({ app, screen, agent, browser }) => {
  test.skip(!isTarget(app.baseUrl, websiteUrl), 'run with --target website');
  await app.open('/');
  await expect(screen.getByRole('heading', /تبدأ اليوم/, { level: 1 })).toBeVisible();
  // Real discovery entry, read-only: never submit a form or start a booking.
  await agent.act('افتح دليل العيادات باستخدام رابط «العيادات» في قائمة الموقع. توقف عند الدليل، ولا تبدأ حجزًا ولا ترسل نموذجًا ولا تدخل أي بيانات.');
  await expect(browser).toHaveURL('/clinics');
  await expect(screen.getByRole('heading', 'عيادة لكل احتياج', { level: 1 })).toBeVisible();
});
