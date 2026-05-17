import { NotFoundException } from '@nestjs/common';
import { GetEmployeeAccountHandler } from './get-employee-account.handler';

const makeEmployee = (overrides: Partial<{ id: string; email: string | null; userId: string | null }> = {}) => ({
  id: 'emp-1',
  email: 'practitioner@example.com',
  name: 'Test Employee',
  userId: null,
  ...overrides,
});

const makeUser = (overrides: Partial<{ id: string; email: string; role: string; isActive: boolean }> = {}) => ({
  id: 'user-1',
  email: 'practitioner@example.com',
  role: 'RECEPTIONIST',
  isActive: true,
  ...overrides,
});

const buildPrisma = (employee: ReturnType<typeof makeEmployee> | null, user?: ReturnType<typeof makeUser> | null) => ({
  employee: {
    findFirst: jest.fn().mockResolvedValue(employee),
  },
  user: {
    findUnique: jest.fn().mockResolvedValue(user ?? null),
  },
});

describe('GetEmployeeAccountHandler', () => {
  it('returns hasAccount=false when employee has no userId', async () => {
    const emp = makeEmployee({ userId: null });
    const prisma = buildPrisma(emp);
    const handler = new GetEmployeeAccountHandler(prisma as never);

    const result = await handler.execute({ employeeId: 'emp-1' });

    expect(result).toEqual({
      hasAccount: false,
      employeeEmail: emp.email,
      account: null,
    });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('returns hasAccount=true with account details when employee has userId', async () => {
    const user = makeUser();
    const emp = makeEmployee({ userId: 'user-1' });
    const prisma = buildPrisma(emp, user);
    const handler = new GetEmployeeAccountHandler(prisma as never);

    const result = await handler.execute({ employeeId: 'emp-1' });

    expect(result).toEqual({
      hasAccount: true,
      employeeEmail: emp.email,
      account: user,
    });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      select: { id: true, email: true, role: true, isActive: true },
    });
  });

  it('throws NotFoundException when employee does not exist', async () => {
    const prisma = buildPrisma(null);
    const handler = new GetEmployeeAccountHandler(prisma as never);

    await expect(handler.execute({ employeeId: 'missing' })).rejects.toThrow(NotFoundException);
  });

  it('returns null employeeEmail when employee has no email', async () => {
    const emp = makeEmployee({ email: null, userId: null });
    const prisma = buildPrisma(emp);
    const handler = new GetEmployeeAccountHandler(prisma as never);

    const result = await handler.execute({ employeeId: 'emp-1' });

    expect(result.employeeEmail).toBeNull();
    expect(result.hasAccount).toBe(false);
  });
});
