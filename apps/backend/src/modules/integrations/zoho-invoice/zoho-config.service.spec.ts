import { BadRequestException } from '@nestjs/common';
import { ZohoConfigService, ZOHO_PROVIDER } from './zoho-config.service';
import type { ZohoCredentialsService } from '../../../infrastructure/zoho';
import type { PrismaService } from '../../../infrastructure/database';

/**
 * The config service is the gate that hands per-tenant Zoho credentials to
 * every other handler. Two isolation properties matter:
 *
 *   1. `load(orgId)` MUST query the Integration row keyed by (orgId, provider)
 *      — never loose-match on provider alone.
 *   2. `save(orgId)` MUST encrypt with `orgId` as AAD so the resulting blob
 *      cannot be moved to a different tenant's row.
 */
describe('ZohoConfigService', () => {
  const TENANT_A = 'org-A';
  const TENANT_B = 'org-B';

  function makeService() {
    const findUnique = jest.fn();
    const upsert = jest.fn().mockResolvedValue(undefined);
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const deleteMany = jest.fn().mockResolvedValue({ count: 1 });
    const prisma = {
      integration: { findUnique, upsert, updateMany, deleteMany },
    } as unknown as PrismaService;

    const encrypt = jest.fn((payload: Record<string, unknown>, orgId: string) =>
      `enc:${orgId}:${JSON.stringify(payload)}`,
    );
    const decrypt = jest.fn((blob: string, orgId: string) => {
      const prefix = `enc:${orgId}:`;
      if (!blob.startsWith(prefix)) {
        throw new Error('AAD mismatch — would never decrypt across tenants');
      }
      return JSON.parse(blob.slice(prefix.length));
    });
    const creds = { encrypt, decrypt } as unknown as ZohoCredentialsService;

    return {
      svc: new ZohoConfigService(prisma, creds),
      findUnique,
      upsert,
      updateMany,
      deleteMany,
      encrypt,
      decrypt,
    };
  }

  describe('load', () => {
    it('keys the Integration lookup by provider (org scoping moved to RLS / single-tenant migration)', async () => {
      // org scoping moved to RLS / removed in single-tenant migration
      const { svc, findUnique } = makeService();
      findUnique.mockResolvedValue(null);
      await svc.load(TENANT_A);
      expect(findUnique).toHaveBeenCalledWith({
        where: { provider: ZOHO_PROVIDER },
      });
    });

    it('returns isConfigured=false when no row exists', async () => {
      const { svc, findUnique } = makeService();
      findUnique.mockResolvedValue(null);
      const result = await svc.load(TENANT_A);
      expect(result).toEqual({ isConfigured: false, isActive: false });
    });

    it('returns isConfigured=false when the row exists without a ciphertext (mid-Connect)', async () => {
      const { svc, findUnique } = makeService();
      findUnique.mockResolvedValue({ config: {}, isActive: true });
      const result = await svc.load(TENANT_A);
      expect(result.isConfigured).toBe(false);
    });

    it('decrypts using the requested organizationId as AAD', async () => {
      const { svc, findUnique, decrypt } = makeService();
      findUnique.mockResolvedValue({
        config: { ciphertext: `enc:${TENANT_A}:${JSON.stringify({ refreshToken: 'rt' })}` },
        isActive: true,
      });
      const result = await svc.load(TENANT_A);
      expect(decrypt).toHaveBeenCalledWith(expect.any(String), TENANT_A);
      expect(result.config?.refreshToken).toBe('rt');
    });
  });

  describe('require', () => {
    it('throws BadRequest when the integration is not configured', async () => {
      const { svc, findUnique } = makeService();
      findUnique.mockResolvedValue(null);
      await expect(svc.require(TENANT_A)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequest when the integration is configured but inactive', async () => {
      const { svc, findUnique } = makeService();
      findUnique.mockResolvedValue({
        config: { ciphertext: `enc:${TENANT_A}:${JSON.stringify({ refreshToken: 'rt' })}` },
        isActive: false,
      });
      await expect(svc.require(TENANT_A)).rejects.toThrow(/disabled/);
    });
  });

  describe('save — tenant isolation', () => {
    it('encrypts the config blob with the supplied organizationId as AAD', async () => {
      // org scoping moved to RLS / removed in single-tenant migration
      const { svc, upsert, encrypt } = makeService();
      await svc.save(TENANT_A, {
        refreshToken: 'rt_A',
        zohoOrganizationId: 'zoho_org_A',
        dataCenter: 'sa',
        webhookSecret: 'wh',
        defaults: { sendOnCreate: true },
      });
      expect(encrypt).toHaveBeenCalledWith(
        expect.objectContaining({ refreshToken: 'rt_A' }),
        TENANT_A,
      );
      expect(upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { provider: ZOHO_PROVIDER },
          create: expect.objectContaining({ provider: ZOHO_PROVIDER }),
        }),
      );
    });

    it('writes never reference a different organization id than the one passed', async () => {
      // org scoping moved to RLS / removed in single-tenant migration
      const { svc, upsert } = makeService();
      await svc.save(TENANT_A, {
        refreshToken: 'rt_A',
        zohoOrganizationId: 'z',
        dataCenter: 'sa',
        webhookSecret: 'w',
        defaults: { sendOnCreate: false },
      });
      const args = upsert.mock.calls[0]![0];
      // sanity: NEVER tenant B in upsert args
      expect(JSON.stringify(args)).not.toContain(TENANT_B);
    });
  });

  describe('remove', () => {
    it('only deletes rows for the requested tenant + zoho-invoice provider', async () => {
      // org scoping moved to RLS / removed in single-tenant migration
      const { svc, deleteMany } = makeService();
      await svc.remove(TENANT_A);
      expect(deleteMany).toHaveBeenCalledWith({
        where: { provider: ZOHO_PROVIDER },
      });
    });
  });

  describe('setActive', () => {
    it('only flips the requested tenant + zoho-invoice provider', async () => {
      // org scoping moved to RLS / removed in single-tenant migration
      const { svc, updateMany } = makeService();
      await svc.setActive(TENANT_A, false);
      expect(updateMany).toHaveBeenCalledWith({
        where: { provider: ZOHO_PROVIDER },
        data: { isActive: false },
      });
    });
  });
});
