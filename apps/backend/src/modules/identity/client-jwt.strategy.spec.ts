import { ClientJwtStrategy } from './client-jwt.strategy';
import { UnauthorizedException } from '@nestjs/common';
import { SINGLE_TENANT_CONTEXT_ID } from '../../common/constants';

describe('ClientJwtStrategy', () => {
  let strategy: ClientJwtStrategy;
  let prisma: { client: { findUnique: jest.Mock } };
  let cls: { set: jest.Mock };

  beforeEach(() => {
    prisma = { client: { findUnique: jest.fn() } };
    cls = { set: jest.fn() };
    strategy = new ClientJwtStrategy(
      { getOrThrow: () => 'client-secret' } as any,
      prisma as any,
      cls as any,
    );
  });

  describe('extractors', () => {
    it('extracts token from cookie when present', () => {
      const req = { cookies: { client_access_token: 'cookie-token' } } as any;
      const token = (strategy as any)._jwtFromRequest(req);
      expect(token).toBe('cookie-token');
    });

    it('falls back to Bearer header when cookie missing', () => {
      const req = { headers: { authorization: 'Bearer header-token' }, cookies: {} } as any;
      const token = (strategy as any)._jwtFromRequest(req);
      expect(token).toBe('header-token');
    });

    it('returns null when no token present', () => {
      const req = { headers: {}, cookies: {} } as any;
      const token = (strategy as any)._jwtFromRequest(req);
      expect(token).toBeNull();
    });
  });

  describe('validate', () => {
    const validPayload = {
      sub: 'c1',
      email: 'client@example.com',
      namespace: 'client' as const,
      jti: 'jti-1',
      organizationId: 'org-1',
      tokenVersion: 1,
    };

    it('returns client when valid', async () => {
      prisma.client.findUnique.mockResolvedValue({
        id: 'c1',
        email: 'client@example.com',
        phone: '+966500000000',
        isActive: true,
        deletedAt: null,
        tokenVersion: 1,
      });

      const result = await strategy.validate({} as any, validPayload);
      expect(result.id).toBe('c1');
      expect(result.organizationId).toBe(SINGLE_TENANT_CONTEXT_ID);
      expect(cls.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ organizationId: SINGLE_TENANT_CONTEXT_ID }),
      );
    });

    it('throws when namespace is not client', async () => {
      await expect(
        strategy.validate({} as any, { ...validPayload, namespace: 'user' as any }),
      ).rejects.toThrow('Invalid token namespace');
    });

    it('accepts token without legacy organizationId and defaults response claim', async () => {
      prisma.client.findUnique.mockResolvedValue({
        id: 'c1',
        email: 'client@example.com',
        phone: '+966500000000',
        isActive: true,
        deletedAt: null,
        tokenVersion: 1,
      });

      const result = await strategy.validate({} as any, { ...validPayload, organizationId: undefined });
      expect(result.organizationId).toBe(SINGLE_TENANT_CONTEXT_ID);
    });

    it('throws when client not found', async () => {
      prisma.client.findUnique.mockResolvedValue(null);
      await expect(strategy.validate({} as any, validPayload)).rejects.toThrow(
        'Client not found or inactive',
      );
    });

    it('throws when client is inactive', async () => {
      prisma.client.findUnique.mockResolvedValue({
        id: 'c1',
        isActive: false,
        deletedAt: null,
        tokenVersion: 1,
      });
      await expect(strategy.validate({} as any, validPayload)).rejects.toThrow(
        'Client not found or inactive',
      );
    });

    it('throws when client is soft-deleted', async () => {
      prisma.client.findUnique.mockResolvedValue({
        id: 'c1',
        isActive: true,
        deletedAt: new Date(),
        tokenVersion: 1,
      });
      await expect(strategy.validate({} as any, validPayload)).rejects.toThrow(
        'Client not found or inactive',
      );
    });

    it('throws when tokenVersion mismatches', async () => {
      prisma.client.findUnique.mockResolvedValue({
        id: 'c1',
        isActive: true,
        deletedAt: null,
        tokenVersion: 2,
      });
      await expect(strategy.validate({} as any, validPayload)).rejects.toThrow(
        'Token has been revoked',
      );
    });
  });
});
