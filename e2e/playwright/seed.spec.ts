import { test } from '@playwright/test';

// Reviewed default seed for the Playwright Test Agents. Committing it means the
// planner and generator never need to create (and run) an uncommitted seed.
test.describe('Test group', () => {
  test('seed', async ({ page }) => {
    await page.goto('/');
  });
});
