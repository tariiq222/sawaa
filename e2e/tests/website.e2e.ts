import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { isTarget, websiteUrl } from '../urls.ts';

// Run with: pnpm e2e:website  (target "website")
test('website home renders the Arabic hero', { tags: ['smoke', 'website'] }, async ({ app, screen, agent }) => {
  test.skip(!isTarget(app.baseUrl, websiteUrl), 'run with --target website');
  await app.open('/');

  // Hero <h1> of apps/website/themes/sawaa/components/sections/hero.tsx
  await expect(screen.getByRole('heading', /تبدأ اليوم/, { level: 1 })).toBeVisible();

  // One safe, read-only agent step: no forms submitted, no data mutated.
  await agent.act('Scroll down the page a little to see the content below the hero. Do not click, submit or type anything.');
  await expect(screen.getByRole('heading', /تبدأ اليوم/, { level: 1 })).toBeVisible();
});
