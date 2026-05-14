/**
 * Playwright fixtures for Zoho Invoice E2E tests.
 *
 * Provides:
 *   - `authedPage` — a Page with the organization-owner's JWT injected via
 *     localStorage (no /login UI round-trip).
 *   - `apiCtx` — an APIRequestContext with the same organization-owner's
 *     Bearer token for direct backend assertions.
 *   - `backendUrl` — backend base URL for direct API calls.
 */
import { test as base, type Page, type APIRequestContext } from '@playwright/test';
import { loginViaApi, type LoginResult } from '@sawaa/test-helpers-pw';
import { PWConfig } from '@sawaa/test-helpers-pw';

type ZohoFixtures = {
  authedPage: Page;
  apiCtx: APIRequestContext;
  backendUrl: string;
  loginResult: LoginResult;
};

export const test = base.extend<ZohoFixtures>({
  backendUrl: [PWConfig.backendBaseUrl, { option: true }],

  loginResult: async ({ request }, runFixture) => {
    // Use admin@sawaa-test.com (the seed user who owns the default org).
    const result = await loginViaApi(
      request,
      process.env.PW_OWNER_EMAIL ?? 'admin@sawaa-test.com',
      process.env.PW_OWNER_PASSWORD ?? 'Admin@1234',
    );
    await runFixture(result);
  },

  apiCtx: async ({ playwright: pw, loginResult }, runFixture) => {
    // The default `request` context shares cookies with the browser context.
    // For API-only assertions we prefer using a separate context with the
    // Bearer header explicitly set.
    const ctx = await pw.request.newContext({
      baseURL: PWConfig.backendBaseUrl,
      extraHTTPHeaders: {
        Authorization: `Bearer ${loginResult.accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    await runFixture(ctx);
    await ctx.dispose();
  },

  authedPage: async ({ page, loginResult }, runFixture) => {
    // addInitScript runs on EVERY page load (including `about:blank`).
    // Set localStorage unconditionally so AuthGate picks up the token.
    // CR-9: refresh token is httpOnly cookie (ck_refresh); not stored in localStorage.
    await page.addInitScript(
      ({ access }) => {
        window.localStorage.setItem('sawaa.accessToken', access);
      },
      { access: loginResult.accessToken },
    );
    await runFixture(page);
  },
});

export { expect } from '@playwright/test';
