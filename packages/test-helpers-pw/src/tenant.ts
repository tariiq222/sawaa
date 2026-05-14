import { request, type APIRequestContext } from '@playwright/test';
import { PWConfig } from './config';
import { loginViaApi } from './auth';

export interface SeededOrg {
  organizationId: string;
  ownerEmail: string;
  ownerPassword: string;
  cleanup: () => Promise<void>;
}

interface SeedOptions {
  vertical?: string;
  prefix?: string;
}

/**
 * Seeds an isolated organization through the super-admin's tenant-create endpoint
 * and returns owner credentials + a cleanup function. The org is suspended on cleanup
 * (we do NOT hard-delete tenants — billing/audit-log retention is intentional).
 *
 * Cleanup-on-suspend is the contract: subsequent runs that attempt to log in as the
 * suspended owner will get 403, which is the desired isolation signal.
 */
export async function seedIsolatedOrg(opts: SeedOptions = {}): Promise<SeededOrg> {
  const apiCtx = await request.newContext();
  const adminAuth = await loginViaApi(
    apiCtx,
    PWConfig.superAdminEmail,
    PWConfig.superAdminPassword,
  );
  const headers = { Authorization: `Bearer ${adminAuth.accessToken}` };

  const stamp = Date.now();
  const prefix = opts.prefix ?? 'pw';
  const slug = `${prefix}-${stamp}`;
  const ownerEmail = `${slug}@example.test`;
  const ownerPassword = 'PwTest@2026';

  const createRes = await apiCtx.post(
    `${PWConfig.backendBaseUrl}/api/v1/admin/organizations`,
    {
      headers,
      data: {
        name: `PW Org ${stamp}`,
        slug,
        verticalSlug: opts.vertical ?? 'family-consulting',
        ownerEmail,
        ownerPassword,
        ownerName: 'PW Owner',
      },
    },
  );
  if (!createRes.ok()) {
    throw new Error(
      `Failed to seed isolated org: ${createRes.status()} ${await createRes.text()}`,
    );
  }
  const created = (await createRes.json()) as { id: string };

  const cleanup = async (): Promise<void> => {
    const stillCtx = await request.newContext();
    try {
      const stillAdmin = await loginViaApi(
        stillCtx,
        PWConfig.superAdminEmail,
        PWConfig.superAdminPassword,
      );
      await stillCtx.post(
        `${PWConfig.backendBaseUrl}/api/v1/admin/organizations/${created.id}/suspend`,
        {
          headers: { Authorization: `Bearer ${stillAdmin.accessToken}` },
          data: { reason: 'pw-test-cleanup' },
        },
      );
    } finally {
      await stillCtx.dispose();
    }
  };

  await apiCtx.dispose();

  return {
    organizationId: created.id,
    ownerEmail,
    ownerPassword,
    cleanup,
  };
}
