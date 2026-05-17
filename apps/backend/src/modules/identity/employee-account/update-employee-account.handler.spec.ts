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

const buildPrisma = (
  employee: ReturnType<typeof makeEmployee> | null,
  updatedUser?: ReturnType<typeof makeUpdatedUser>,
) => ({
  employee: {
    findFirst: jest.fn().mockResolvedValue(employee),
  },
  user: {
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

    await handler.execute({ employeeId: 'emp-1', role: 'RECEPTIONIST' as never });

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
      handler.execute({ employeeId: 'missing', role: 'ADMIN' as never }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when employee has no linked account', async () => {
    const emp = makeEmployee({ userId: null });
    const prisma = buildPrisma(emp);
    const handler = new UpdateEmployeeAccountHandler(prisma as never);

    await expect(
      handler.execute({ employeeId: 'emp-1', isActive: true }),
    ).rejects.toThrow(NotFoundException);
  });
});
