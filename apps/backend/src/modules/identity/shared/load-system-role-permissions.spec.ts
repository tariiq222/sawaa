import { loadSystemRolePermissions } from './load-system-role-permissions';
import type { PrismaService } from '../../../infrastructure/database';

describe('loadSystemRolePermissions', () => {
  const makePrisma = (perms: Array<{ action: string; subject: string }> | null) =>
    ({
      customRole: {
        findFirst: jest.fn().mockResolvedValue(
          perms === null ? null : { permissions: perms },
        ),
      },
    }) as unknown as PrismaService & { customRole: { findFirst: jest.Mock } };

  it('returns DB permissions for a built-in system role', async () => {
    const prisma = makePrisma([{ action: 'read', subject: 'Booking' }]);
    const result = await loadSystemRolePermissions(prisma, 'RECEPTIONIST');
    expect(result).toEqual([{ action: 'read', subject: 'Booking' }]);
    expect((prisma as any).customRole.findFirst).toHaveBeenCalledWith({
      where: { systemKey: 'RECEPTIONIST' },
      select: { permissions: { select: { action: true, subject: true } } },
    });
  });

  it('returns null and skips the lookup for SUPER_ADMIN', async () => {
    const prisma = makePrisma([{ action: 'read', subject: 'Booking' }]);
    const result = await loadSystemRolePermissions(prisma, 'SUPER_ADMIN');
    expect(result).toBeNull();
    expect((prisma as any).customRole.findFirst).not.toHaveBeenCalled();
  });

  it('returns null and skips the lookup for CLIENT', async () => {
    const prisma = makePrisma([{ action: 'read', subject: 'Booking' }]);
    const result = await loadSystemRolePermissions(prisma, 'CLIENT');
    expect(result).toBeNull();
    expect((prisma as any).customRole.findFirst).not.toHaveBeenCalled();
  });

  it('returns null for a null/undefined role', async () => {
    const prisma = makePrisma([{ action: 'read', subject: 'Booking' }]);
    expect(await loadSystemRolePermissions(prisma, null)).toBeNull();
    expect(await loadSystemRolePermissions(prisma, undefined)).toBeNull();
    expect((prisma as any).customRole.findFirst).not.toHaveBeenCalled();
  });

  it('returns null when no system role row exists in the DB', async () => {
    const prisma = makePrisma(null);
    const result = await loadSystemRolePermissions(prisma, 'ADMIN');
    expect(result).toBeNull();
  });
});
