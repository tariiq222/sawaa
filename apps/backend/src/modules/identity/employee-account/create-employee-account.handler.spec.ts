import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { CreateEmployeeAccountHandler } from './create-employee-account.handler';

const makeEmployee = (overrides: Partial<{
  id: string;
  email: string | null;
  name: string;
  userId: string | null;
}> = {}) => ({
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

const buildTx = (user?: ReturnType<typeof makeUser>) => ({
  user: {
    update: jest.fn().mockResolvedValue(user ?? makeUser()),
    create: jest.fn().mockResolvedValue(user ?? makeUser()),
  },
  employee: {
    update: jest.fn().mockResolvedValue({}),
  },
});

// By default the actor is a SUPER_ADMIN so existing role-assignment assertions
// (ADMIN / RECEPTIONIST) pass the rank gate. Override `actor` to test denials.
const buildPrisma = (
  employee: ReturnType<typeof makeEmployee> | null,
  existingUser: ReturnType<typeof makeUser> | null,
  tx: ReturnType<typeof buildTx>,
  actor: { role: string; isSuperAdmin: boolean } | null = { role: 'SUPER_ADMIN', isSuperAdmin: true },
) => ({
  employee: {
    findFirst: jest.fn().mockResolvedValue(employee),
  },
  user: {
    // Actor lookup is by { id }, the existing-account lookup is by { email }.
    findUnique: jest.fn(({ where }: { where: { id?: string; email?: string } }) =>
      Promise.resolve(where.id ? actor : existingUser),
    ),
  },
  $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(tx)),
});

const buildRlsTransaction = (prisma: ReturnType<typeof buildPrisma>) => {
  const $txMock = prisma.$transaction as jest.Mock;
  return {
    withTransaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      return $txMock.getMockImplementation()!(fn);
    }),
  };
};

const buildPassword = () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
});

describe('CreateEmployeeAccountHandler', () => {
  it('links an existing user when one matches the employee email (happy path)', async () => {
    const emp = makeEmployee();
    const existingUser = makeUser({ id: 'user-existing' });
    const tx = buildTx(existingUser);
    const prisma = buildPrisma(emp, existingUser, tx);
    const password = buildPassword();
    const handler = new CreateEmployeeAccountHandler(
      prisma as never,
      buildRlsTransaction(prisma) as never,
      password as never,
    );

    const result = await handler.execute({ employeeId: 'emp-1', role: 'ADMIN' as never, actorUserId: 'actor-1' });

    // Should update the existing user's role, not create a new user
    expect(tx.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'user-existing' },
      data: { role: 'ADMIN' },
    }));
    expect(tx.user.create).not.toHaveBeenCalled();
    // Should not hash password when linking existing user
    expect(password.hash).not.toHaveBeenCalled();
    // Should link employee
    expect(tx.employee.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'emp-1' },
      data: { userId: existingUser.id },
    }));
    expect(result).toMatchObject({ id: existingUser.id });
  });

  it('creates a new user when no existing user matches the employee email (happy path)', async () => {
    const emp = makeEmployee();
    const tx = buildTx();
    const prisma = buildPrisma(emp, null, tx);
    const password = buildPassword();
    const handler = new CreateEmployeeAccountHandler(
      prisma as never,
      buildRlsTransaction(prisma) as never,
      password as never,
    );

    await handler.execute({ employeeId: 'emp-1', role: 'RECEPTIONIST' as never, password: 'P@ssw0rd123', actorUserId: 'actor-1' });

    expect(password.hash).toHaveBeenCalledWith('P@ssw0rd123');
    expect(tx.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        email: emp.email,
        name: emp.name,
        role: 'RECEPTIONIST',
        passwordHash: 'hashed-password',
      }),
    }));
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when employee does not exist', async () => {
    const tx = buildTx();
    const prisma = buildPrisma(null, null, tx);
    const handler = new CreateEmployeeAccountHandler(
      prisma as never,
      buildRlsTransaction(prisma) as never,
      buildPassword() as never,
    );

    await expect(
      handler.execute({ employeeId: 'missing', role: 'ADMIN' as never, actorUserId: 'actor-1' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws ConflictException when employee already has a linked account', async () => {
    const emp = makeEmployee({ userId: 'existing-user-id' });
    const tx = buildTx();
    const prisma = buildPrisma(emp, null, tx);
    const handler = new CreateEmployeeAccountHandler(
      prisma as never,
      buildRlsTransaction(prisma) as never,
      buildPassword() as never,
    );

    await expect(
      handler.execute({ employeeId: 'emp-1', role: 'ADMIN' as never, actorUserId: 'actor-1' }),
    ).rejects.toThrow(ConflictException);
  });

  it('throws BadRequestException when employee has no email', async () => {
    const emp = makeEmployee({ email: null });
    const tx = buildTx();
    const prisma = buildPrisma(emp, null, tx);
    const handler = new CreateEmployeeAccountHandler(
      prisma as never,
      buildRlsTransaction(prisma) as never,
      buildPassword() as never,
    );

    await expect(
      handler.execute({ employeeId: 'emp-1', role: 'ADMIN' as never, actorUserId: 'actor-1' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when no existing user and no password provided', async () => {
    const emp = makeEmployee();
    const tx = buildTx();
    const prisma = buildPrisma(emp, null, tx);
    const handler = new CreateEmployeeAccountHandler(
      prisma as never,
      buildRlsTransaction(prisma) as never,
      buildPassword() as never,
    );

    await expect(
      handler.execute({ employeeId: 'emp-1', role: 'ADMIN' as never, actorUserId: 'actor-1' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects when the actor outranks neither the requested role (rank gate)', async () => {
    const emp = makeEmployee();
    const tx = buildTx();
    // Actor is an ADMIN trying to grant ADMIN — at-or-above own rank, must fail.
    const prisma = buildPrisma(emp, null, tx, { role: 'ADMIN', isSuperAdmin: false });
    const handler = new CreateEmployeeAccountHandler(
      prisma as never,
      buildRlsTransaction(prisma) as never,
      buildPassword() as never,
    );

    await expect(
      handler.execute({ employeeId: 'emp-1', role: 'ADMIN' as never, actorUserId: 'actor-1' }),
    ).rejects.toThrow('Cannot assign a role at or above your rank');
    expect(prisma.employee.findFirst).not.toHaveBeenCalled();
  });

  it('rejects when the actor cannot be found', async () => {
    const emp = makeEmployee();
    const tx = buildTx();
    const prisma = buildPrisma(emp, null, tx, null);
    const handler = new CreateEmployeeAccountHandler(
      prisma as never,
      buildRlsTransaction(prisma) as never,
      buildPassword() as never,
    );

    await expect(
      handler.execute({ employeeId: 'emp-1', role: 'RECEPTIONIST' as never, actorUserId: 'ghost' }),
    ).rejects.toThrow('Actor not found');
  });
});
