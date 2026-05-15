import { SuperAdminGuard } from './super-admin.guard';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';

describe('SuperAdminGuard', () => {
  let guard: SuperAdminGuard;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = { user: { findUnique: jest.fn() } };
    guard = new SuperAdminGuard(mockPrisma);
  });

  it('allows super admin', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ isSuperAdmin: true });
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ user: { isSuperAdmin: true, sub: 'user-1' } }),
      }),
    } as ExecutionContext;
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('blocks non-super admin from JWT', async () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ user: { isSuperAdmin: false, sub: 'user-1' } }),
      }),
    } as ExecutionContext;
    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('blocks when prisma says not super admin', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ isSuperAdmin: false });
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ user: { isSuperAdmin: true, sub: 'user-1' } }),
      }),
    } as ExecutionContext;
    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });
});
