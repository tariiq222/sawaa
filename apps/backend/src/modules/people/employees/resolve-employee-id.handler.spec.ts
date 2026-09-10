import { ForbiddenException } from '@nestjs/common';
import { ResolveEmployeeIdHandler } from './resolve-employee-id.handler';

describe('ResolveEmployeeIdHandler', () => {
  let handler: ResolveEmployeeIdHandler;
  let prisma: { employee: { findFirst: jest.Mock } };

  beforeEach(() => {
    prisma = { employee: { findFirst: jest.fn() } };
    handler = new ResolveEmployeeIdHandler(prisma as never);
  });

  it('returns the employeeId claim without querying the database', async () => {
    const result = await handler.execute({
      userId: 'user-sub-1',
      employeeId: 'employee-7',
    });

    expect(result).toBe('employee-7');
    expect(prisma.employee.findFirst).not.toHaveBeenCalled();
  });

  it('resolves an active employee profile when the claim is missing', async () => {
    prisma.employee.findFirst.mockResolvedValue({ id: 'employee-42' });

    const result = await handler.execute({ userId: 'user-sub-1' });

    expect(result).toBe('employee-42');
    expect(prisma.employee.findFirst).toHaveBeenCalledWith({
      where: { userId: 'user-sub-1', isActive: true },
      select: { id: true },
    });
  });

  it('throws ForbiddenException when no active employee profile exists', async () => {
    prisma.employee.findFirst.mockResolvedValue(null);

    await expect(handler.execute({ userId: 'user-sub-1' })).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('looks up the employee profile when the claim is empty', async () => {
    prisma.employee.findFirst.mockResolvedValue({ id: 'employee-99' });

    const result = await handler.execute({
      userId: 'user-sub-1',
      employeeId: '',
    });

    expect(result).toBe('employee-99');
    expect(prisma.employee.findFirst).toHaveBeenCalledTimes(1);
  });
});
