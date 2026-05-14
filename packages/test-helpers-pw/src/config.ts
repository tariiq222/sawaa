const required = (name: string, fallback?: string): string => {
  const v = process.env[name] ?? fallback;
  if (!v) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
};

export const PWConfig = {
  backendBaseUrl: required('PW_BACKEND_URL', 'http://localhost:5100'),
  dashboardBaseUrl: required('PW_DASHBOARD_URL', 'http://localhost:5103'),
  adminBaseUrl: required('PW_ADMIN_URL', 'http://localhost:5104'),
  websiteBaseUrl: required('PW_WEBSITE_URL', 'http://localhost:5105'),

  superAdminEmail: required('PW_SUPER_ADMIN_EMAIL', 'tariq.alwalidi@gmail.com'),
  superAdminPassword: required('PW_SUPER_ADMIN_PASSWORD', 'Admin@2026'),

  defaultOrgId: required('PW_DEFAULT_ORG_ID', '00000000-0000-0000-0000-000000000001'),

  authStateDir: process.env.PW_AUTH_STATE_DIR ?? 'e2e/.auth',

  // hCaptcha shim — backend reads CAPTCHA_PROVIDER. Tests must run with `noop`.
  captchaToken: 'pw-test-captcha',
} as const;

export type PWConfigT = typeof PWConfig;
