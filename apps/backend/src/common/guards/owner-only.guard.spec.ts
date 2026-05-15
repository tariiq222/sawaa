import { OwnerOnlyGuard } from './owner-only.guard';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';

describe('OwnerOnlyGuard', () => {
  let guard: OwnerOnlyGuard;
  let mockPrisma: any;
  const originalEnv = process.env.OWNER_EMAILS;

  beforeEach(() => {
    process.env.OWNER_EMAILS = 'owner@test.com';
    mockPrisma = { user: { findUnique: jest.fn() } };
    guard = new OwnerOnlyGuard(mockPrisma);
  });

  afterEach(() => {
    process.env.OWNER_EMAILS = originalEnv;
  });

  it('allows owner email', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ email: 'owner@test.com' });
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ user: { sub: 'user-1' } }),
      }),
    } as ExecutionContext;
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('blocks non-owner email', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ email: 'other@test.com' });
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ user: { sub: 'user-1' } }),
      }),
    } as ExecutionContext;
    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('blocks when owner_emails not configured', async () => {
    process.env.OWNER_EMAILS = '';
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ user: { sub: 'user-1' } }),
      }),
    } as ExecutionContext;
    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });
});
