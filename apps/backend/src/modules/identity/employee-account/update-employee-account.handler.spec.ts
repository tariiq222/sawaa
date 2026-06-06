import { NotFoundException } from '@nestjs/common';
import { UpdateEmployeeAccountHandler } from './update-employee-account.handler';

const makeEmployee = (overrides: Partial<{ id: string; userId: string | null }> = {}) => ({
  id: 'emp-1',
  email: 'practitioner@example.com',
  name: 'Test Employee',
  userId: 'user-1',
  ...overrides,
});

const makeUpdatedUser = (overrides: Partial<{ id: string; email: string; role: string; isActive: boolean }> = {}) => ({
  id: 'user-1',
  email: 'practitioner@example.com',
  role: 'ADMIN',
  isActive: false,
  ...overrides,
});

// Actor defaults to a SUPER_ADMIN so existing role-change assertions pass the
// rank gate. Override `actor` to test denials.
const buildPrisma = (
  employee: ReturnType<typeof makeEmployee> | null,
  updatedUser?: ReturnType<typeof makeUpdatedUser>,
  actor: { role: string; isSuperAdmin: boolean } | null = { role: 'SUPER_ADMIN', isSuperAdmin: true },
) => ({
  employee: {
    findFirst: jest.fn().mockResolvedValue(employee),
  },
  user: {
    findUnique: jest.fn().mockResolvedValue(actor),
    update: jest.fn().mockResolvedValue(updatedUser ?? makeUpdatedUser()),
  },
});

describe('UpdateEmployeeAccountHandler', () => {
  it('updates role and isActive on the linked user (happy path)', async () => {
    const emp = makeEmployee();
    const updated = makeUpdatedUser({ role: 'ADMIN', isActive: false });
    const prisma = buildPrisma(emp, updated);
    const handler = new UpdateEmployeeAccountHandler(prisma as never);

    const result = await handler.execute({
      employeeId: 'emp-1',
      role: 'ADMIN' as never,
      isActive: false,
      actorUserId: 'actor-1',
    });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { role: 'ADMIN', isActive: false },
      omit: { passwordHash: true },
    });
    expect(result).toMatchObject({ role: 'ADMIN', isActive: false });
  });

  it('updates only role when isActive is not provided', async () => {
    const emp = makeEmployee();
    const updated = makeUpdatedUser({ role: 'RECEPTIONIST', isActive: true });
    const prisma = buildPrisma(emp, updated);
    const handler = new UpdateEmployeeAccountHandler(prisma as never);

    await handler.execute({ employeeId: 'emp-1', role: 'RECEPTIONIST' as never, actorUserId: 'actor-1' });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { role: 'RECEPTIONIST', isActive: undefined },
      omit: { passwordHash: true },
    });
  });

  it('throws NotFoundException when employee does not exist', async () => {
    const prisma = buildPrisma(null);
    const handler = new UpdateEmployeeAccountHandler(prisma as never);

    await expect(
      handler.execute({ employeeId: 'missing', role: 'ADMIN' as never, actorUserId: 'actor-1' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when employee has no linked account', async () => {
    const emp = makeEmployee({ userId: null });
    const prisma = buildPrisma(emp);
    const handler = new UpdateEmployeeAccountHandler(prisma as never);

    await expect(
      handler.execute({ employeeId: 'emp-1', isActive: true, actorUserId: 'actor-1' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('blocks re-roling your own linked account (self-escalation)', async () => {
    // employee.userId === actorUserId → self-target
    const emp = makeEmployee({ userId: 'user-1' });
    const prisma = buildPrisma(emp);
    const handler = new UpdateEmployeeAccountHandler(prisma as never);

    await expect(
      handler.execute({ employeeId: 'emp-1', role: 'ADMIN' as never, actorUserId: 'user-1' }),
    ).rejects.toThrow('Cannot change your own role');
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('rejects when the actor outranks neither the requested role (rank gate)', async () => {
    const emp = makeEmployee();
    // Actor is an ADMIN trying to grant ADMIN — must fail.
    const prisma = buildPrisma(emp, undefined, { role: 'ADMIN', isSuperAdmin: false });
    const handler = new UpdateEmployeeAccountHandler(prisma as never);

    await expect(
      handler.execute({ employeeId: 'emp-1', role: 'ADMIN' as never, actorUserId: 'actor-1' }),
    ).rejects.toThrow('Cannot assign a role at or above your rank');
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
