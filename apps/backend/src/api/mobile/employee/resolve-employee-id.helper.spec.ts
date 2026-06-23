import { ForbiddenException } from '@nestjs/common';
import { resolveEmployeeId } from './resolve-employee-id.helper';
import type { JwtUser } from '../../../common/auth/current-user.decorator';

const baseUser: JwtUser = {
  sub: 'user-sub-1',
  roles: ['EMPLOYEE'],
  permissions: [],
};

describe('resolveEmployeeId', () => {
  let prisma: { employee: { findFirst: jest.Mock } };

  beforeEach(() => {
    prisma = { employee: { findFirst: jest.fn() } };
  });

  it('returns user.employeeId directly when the JWT carries it (fast path)', async () => {
    const user: JwtUser = { ...baseUser, employeeId: 'employee-7' };
    const result = await resolveEmployeeId(prisma as never, user);
    expect(result).toBe('employee-7');
    expect(prisma.employee.findFirst).not.toHaveBeenCalled();
  });

  it('resolves Employee.id from User.sub when employeeId claim is missing', async () => {
    prisma.employee.findFirst.mockResolvedValue({ id: 'employee-42' });
    const result = await resolveEmployeeId(prisma as never, baseUser);
    expect(result).toBe('employee-42');
    expect(prisma.employee.findFirst).toHaveBeenCalledWith({
      where: { userId: 'user-sub-1', isActive: true },
      select: { id: true },
    });
  });

  it('throws ForbiddenException when no active employee profile exists', async () => {
    prisma.employee.findFirst.mockResolvedValue(null);
    await expect(resolveEmployeeId(prisma as never, baseUser)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('does NOT short-circuit when user.employeeId is an empty string', async () => {
    // Empty string is falsy → falls through to the DB lookup (correct behaviour).
    const user: JwtUser = { ...baseUser, employeeId: '' };
    prisma.employee.findFirst.mockResolvedValue({ id: 'employee-99' });
    const result = await resolveEmployeeId(prisma as never, user);
    expect(result).toBe('employee-99');
    expect(prisma.employee.findFirst).toHaveBeenCalledTimes(1);
  });

  it('uses an explicit "employeeId in JWT" path when employeeId is provided even if sub also matches', async () => {
    const user: JwtUser = { ...baseUser, sub: 'user-sub-1', employeeId: 'fast-1' };
    const result = await resolveEmployeeId(prisma as never, user);
    expect(result).toBe('fast-1');
    expect(prisma.employee.findFirst).not.toHaveBeenCalled();
  });
});
