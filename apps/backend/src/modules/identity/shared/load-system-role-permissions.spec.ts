import { loadSystemRolePermissions } from './load-system-role-permissions';
import type { PrismaService } from '../../../infrastructure/database';

describe('loadSystemRolePermissions', () => {
  // Loader does 1 DB call on the common path and 2 calls on the empty-row
  // edge case (second call only fetches `permissionsCustomized`). This
  // helper builds a mock that returns the right responses in order.
  const makePrisma = (
    firstCall: unknown,
    secondCall: unknown = null,
  ) => {
    const findFirst = jest
      .fn()
      .mockResolvedValueOnce(firstCall)
      .mockResolvedValueOnce(secondCall);
    return {
      customRole: { findFirst },
    } as unknown as PrismaService & { customRole: { findFirst: jest.Mock } };
  };

  it('returns DB permissions for a built-in system role (1 DB call)', async () => {
    const prisma = makePrisma({
      permissions: [{ action: 'read', subject: 'Booking' }],
    });
    const result = await loadSystemRolePermissions(prisma, 'RECEPTIONIST');
    expect(result).toEqual([{ action: 'read', subject: 'Booking' }]);
    expect((prisma as any).customRole.findFirst).toHaveBeenCalledTimes(1);
    expect((prisma as any).customRole.findFirst).toHaveBeenCalledWith({
      where: { systemKey: 'RECEPTIONIST' },
      select: { permissions: { select: { action: true, subject: true } } },
    });
  });

  it('returns DB permissions for a customized system role with rows (1 DB call)', async () => {
    const prisma = makePrisma({
      permissions: [{ action: 'read', subject: 'Report' }],
    });
    const result = await loadSystemRolePermissions(prisma, 'ADMIN');
    expect(result).toEqual([{ action: 'read', subject: 'Report' }]);
    expect((prisma as any).customRole.findFirst).toHaveBeenCalledTimes(1);
  });

  it('returns [] for a customized system role with zero rows (explicit deny-all preserved)', async () => {
    // RX-PERMS-EMPTY: bootstrap will auto-heal this state on the next boot,
    // but until then the factory must still treat it as deny-all so an
    // admin's deliberate edit doesn't suddenly gain permissions via fallback.
    const prisma = makePrisma(
      { permissions: [] }, // 1st call: empty permissions
      { permissionsCustomized: true }, // 2nd call: customized flag
    );
    const result = await loadSystemRolePermissions(prisma, 'ADMIN');
    expect(result).toEqual([]);
    expect((prisma as any).customRole.findFirst).toHaveBeenCalledTimes(2);
    // Second call is the customized-flag-only lookup.
    expect((prisma as any).customRole.findFirst).toHaveBeenLastCalledWith({
      where: { systemKey: 'ADMIN' },
      select: { permissionsCustomized: true },
    });
  });

  it('returns null for an uncustomized system role with zero rows (BUILT_IN fallback)', async () => {
    // RX-PERMS-EMPTY (live-data fix): a zero-row uncustomized row matches a
    // failed seed. Returning null here lets buildForUser fall back to BUILT_IN
    // so the user keeps built-in grants (e.g. RECEPTIONIST's create:Payment).
    const prisma = makePrisma(
      { permissions: [] },
      { permissionsCustomized: false },
    );
    const result = await loadSystemRolePermissions(prisma, 'RECEPTIONIST');
    expect(result).toBeNull();
    expect((prisma as any).customRole.findFirst).toHaveBeenCalledTimes(2);
  });

  it('returns null and skips the lookup for SUPER_ADMIN', async () => {
    const prisma = makePrisma({
      permissions: [{ action: 'read', subject: 'Booking' }],
    });
    const result = await loadSystemRolePermissions(prisma, 'SUPER_ADMIN');
    expect(result).toBeNull();
    expect((prisma as any).customRole.findFirst).not.toHaveBeenCalled();
  });

  it('returns null and skips the lookup for CLIENT', async () => {
    const prisma = makePrisma({
      permissions: [{ action: 'read', subject: 'Booking' }],
    });
    const result = await loadSystemRolePermissions(prisma, 'CLIENT');
    expect(result).toBeNull();
    expect((prisma as any).customRole.findFirst).not.toHaveBeenCalled();
  });

  it('returns null for a null/undefined role', async () => {
    const prisma = makePrisma({
      permissions: [{ action: 'read', subject: 'Booking' }],
    });
    expect(await loadSystemRolePermissions(prisma, null)).toBeNull();
    expect(await loadSystemRolePermissions(prisma, undefined)).toBeNull();
    expect((prisma as any).customRole.findFirst).not.toHaveBeenCalled();
  });

  it('returns null when no system role row exists in the DB (1 DB call only)', async () => {
    const prisma = makePrisma(null);
    const result = await loadSystemRolePermissions(prisma, 'ADMIN');
    expect(result).toBeNull();
    // No row → bail out before the second lookup.
    expect((prisma as any).customRole.findFirst).toHaveBeenCalledTimes(1);
  });
});
