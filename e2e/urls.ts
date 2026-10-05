export const dashboardUrl = process.env.E2E_DASHBOARD_URL ?? 'http://localhost:5203';
export const websiteUrl = process.env.E2E_WEBSITE_URL ?? 'http://localhost:5205';

const origin = (u: string) => new URL(u).origin;
/** Every test runs on every target; tests skip themselves on the other app's target. */
export const isTarget = (baseUrl: string | undefined, expected: string) =>
  baseUrl !== undefined && origin(baseUrl) === origin(expected);
