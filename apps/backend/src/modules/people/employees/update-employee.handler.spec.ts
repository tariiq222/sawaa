import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { EventBusService } from '../../../infrastructure/events';
import { UpdateEmployeeHandler } from './update-employee.handler';

function createEmployee(overrides?: Partial<any>) {
  return {
    id: 'e1',
    name: 'John',
    isActive: true,
    userId: null,
    email: 'john@example.com',
    ...overrides,
  };
}

function conflictResponse(err: unknown) {
  expect(err).toBeInstanceOf(ConflictException);
  const conflict = err as ConflictException;
  expect(conflict.getStatus()).toBe(409);
  return conflict.getResponse() as Record<string, unknown>;
}

describe('UpdateEmployeeHandler', () => {
  let handler: UpdateEmployeeHandler;
  let prisma: any;
  let eventBus: any;
  let rlsTransaction: { withTransaction: jest.Mock };

  beforeEach(async () => {
    prisma = {
      employee: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      user: {
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
      },
    };
    rlsTransaction = {
      withTransaction: jest.fn(async (cb: (tx: typeof prisma) => Promise<unknown>) => cb(prisma)),
    };
    eventBus = { publish: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdateEmployeeHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: RlsTransactionService, useValue: rlsTransaction },
        { provide: EventBusService, useValue: eventBus },
      ],
    }).compile();

    handler = module.get<UpdateEmployeeHandler>(UpdateEmployeeHandler);
  });

  function stubLoadedEmployee(
    overrides?: Partial<any>,
    collision?: { employee?: { id: string } | null; user?: { id: string } | null },
  ) {
    const employee = createEmployee(overrides);
    prisma.employee.findFirst.mockImplementation(async (args: { where?: { id?: unknown } }) => {
      if (typeof args?.where?.id === 'string') return employee;
      return collision?.employee ?? null;
    });
    prisma.user.findFirst.mockResolvedValue(collision?.user ?? null);
    return employee;
  }

  it('should be defined', () => expect(handler).toBeDefined());

  it('should throw when employee not found', async () => {
    prisma.employee.findFirst.mockResolvedValue(null);
    await expect(handler.execute({ employeeId: 'e1' } as any)).rejects.toThrow(NotFoundException);
  });

  it('should update employee without event', async () => {
    prisma.employee.findFirst.mockResolvedValue(createEmployee());
    prisma.employee.update.mockResolvedValue({ id: 'e1', name: 'Jane' });
    const result = await handler.execute({ employeeId: 'e1', name: 'Jane' } as any);
    expect(result.id).toBe('e1');
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it('should set avatarUrl when provided', async () => {
    prisma.employee.findFirst.mockResolvedValue(createEmployee());
    prisma.employee.update.mockResolvedValue({ id: 'e1' });
    await handler.execute({ employeeId: 'e1', avatarUrl: 'http://img' } as any);
    expect(prisma.employee.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ avatarUrl: 'http://img' }),
    }));
  });

  it('should set name from nameAr when provided', async () => {
    prisma.employee.findFirst.mockResolvedValue(createEmployee());
    prisma.employee.update.mockResolvedValue({ id: 'e1' });
    await handler.execute({ employeeId: 'e1', nameAr: 'جون' } as any);
    expect(prisma.employee.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ name: 'جون' }),
    }));
  });

  it('should set name from nameEn when nameAr missing', async () => {
    prisma.employee.findFirst.mockResolvedValue(createEmployee());
    prisma.employee.update.mockResolvedValue({ id: 'e1' });
    await handler.execute({ employeeId: 'e1', nameEn: 'Johnny' } as any);
    expect(prisma.employee.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ name: 'Johnny' }),
    }));
  });

  it('should publish reactivated event', async () => {
    prisma.employee.findFirst.mockResolvedValue(createEmployee({ isActive: false }));
    prisma.employee.update.mockResolvedValue({ id: 'e1', isActive: true });
    await handler.execute({ employeeId: 'e1', isActive: true } as any);
    expect(eventBus.publish).toHaveBeenCalledWith('people.employee.reactivated', expect.any(Object));
  });

  it('should publish deactivated event', async () => {
    prisma.employee.findFirst.mockResolvedValue(createEmployee({ isActive: true }));
    prisma.employee.update.mockResolvedValue({ id: 'e1', isActive: false });
    await handler.execute({ employeeId: 'e1', isActive: false } as any);
    expect(eventBus.publish).toHaveBeenCalledWith('people.employee.deactivated', expect.any(Object));
  });

  it('should swallow event publish error', async () => {
    prisma.employee.findFirst.mockResolvedValue(createEmployee({ isActive: false }));
    prisma.employee.update.mockResolvedValue({ id: 'e1', isActive: true });
    eventBus.publish.mockRejectedValue(new Error('fail'));
    await expect(handler.execute({ employeeId: 'e1', isActive: true } as any)).resolves.not.toThrow();
  });

  it('updates email on an unlinked employee without touching User', async () => {
    stubLoadedEmployee({ userId: null, email: 'old@example.com' });
    prisma.employee.update.mockResolvedValue({ id: 'e1', email: 'new@example.com' });

    const result = await handler.execute({ employeeId: 'e1', email: '  New@Example.COM  ' } as any);

    expect(result.email).toBe('new@example.com');
    expect(prisma.employee.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ email: 'new@example.com' }),
    }));
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(rlsTransaction.withTransaction).toHaveBeenCalledTimes(1);
  });

  it('atomically updates Employee.email and linked User.email without touching tokenVersion', async () => {
    stubLoadedEmployee({ userId: 'u1', email: 'old@example.com' });
    prisma.employee.update.mockResolvedValue({ id: 'e1', email: 'new@example.com' });
    prisma.user.update.mockResolvedValue({ id: 'u1', email: 'new@example.com' });

    await handler.execute({ employeeId: 'e1', email: 'New@Example.COM' } as any);

    expect(rlsTransaction.withTransaction).toHaveBeenCalledTimes(1);
    expect(prisma.employee.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ email: 'new@example.com' }),
    }));
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { email: 'new@example.com' },
    });
    const userUpdateData = prisma.user.update.mock.calls[0][0].data;
    expect(userUpdateData).not.toHaveProperty('tokenVersion');
    expect(userUpdateData).not.toHaveProperty('role');
    expect(userUpdateData).not.toHaveProperty('passwordHash');
  });

  it('accepts the same current email (including case/whitespace) without 409', async () => {
    stubLoadedEmployee({ userId: 'u1', email: 'same@example.com' });
    prisma.employee.update.mockResolvedValue({ id: 'e1', email: 'same@example.com' });
    prisma.user.update.mockResolvedValue({ id: 'u1', email: 'same@example.com' });

    await expect(
      handler.execute({ employeeId: 'e1', email: '  SAME@example.com  ' } as any),
    ).resolves.toEqual(expect.objectContaining({ id: 'e1' }));

    expect(prisma.employee.update).toHaveBeenCalled();
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { email: 'same@example.com' },
    });
    expect(prisma.employee.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        email: { equals: 'same@example.com', mode: 'insensitive' },
        id: { not: 'e1' },
      },
    }));
    expect(prisma.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        email: { equals: 'same@example.com', mode: 'insensitive' },
        id: { not: 'u1' },
      },
    }));
  });

  it('rejects an employee email collision with 409 and no owner leak or mutation', async () => {
    stubLoadedEmployee({ userId: 'u1', email: 'old@example.com' }, { employee: { id: 'other-emp' } });

    const err = await handler.execute({ employeeId: 'e1', email: 'taken@example.com' } as any).catch((e) => e);
    const body = conflictResponse(err);
    expect(body.message).toBe('This email is already in use');
    expect(body.messageAr).toBe('هذا البريد الإلكتروني مستخدم بالفعل');
    expect(body.code).toBe('EMAIL_ALREADY_IN_USE');
    expect(JSON.stringify(body)).not.toContain('other-emp');
    expect(JSON.stringify(body)).not.toContain('taken@example.com');
    expect(prisma.employee.update).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('rejects a user email collision with 409 and no owner leak or mutation', async () => {
    stubLoadedEmployee({ userId: 'u1', email: 'old@example.com' }, { user: { id: 'other-user' } });

    const err = await handler.execute({ employeeId: 'e1', email: 'owner@hidden.com' } as any).catch((e) => e);
    const body = conflictResponse(err);
    expect(body.code).toBe('EMAIL_ALREADY_IN_USE');
    expect(JSON.stringify(body)).not.toContain('other-user');
    expect(JSON.stringify(body)).not.toContain('owner@hidden.com');
    expect(prisma.employee.update).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('rejects a mixed-case employee email collision with 409 and no mutation', async () => {
    stubLoadedEmployee({ userId: 'u1', email: 'old@example.com' }, { employee: { id: 'other-emp' } });

    const err = await handler.execute({ employeeId: 'e1', email: '  Taken@Example.COM  ' } as any).catch((e) => e);
    const body = conflictResponse(err);
    expect(body.message).toBe('This email is already in use');
    expect(body.messageAr).toBe('هذا البريد الإلكتروني مستخدم بالفعل');
    expect(body.code).toBe('EMAIL_ALREADY_IN_USE');
    expect(JSON.stringify(body)).not.toContain('other-emp');
    expect(JSON.stringify(body)).not.toContain('Taken@Example.COM');
    expect(prisma.employee.update).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.employee.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        email: { equals: 'taken@example.com', mode: 'insensitive' },
        id: { not: 'e1' },
      },
      select: { id: true },
    }));
  });

  it('rejects a mixed-case user email collision with 409 and no mutation', async () => {
    stubLoadedEmployee({ userId: 'u1', email: 'old@example.com' }, { user: { id: 'other-user' } });

    const err = await handler.execute({ employeeId: 'e1', email: 'Owner@Hidden.COM' } as any).catch((e) => e);
    const body = conflictResponse(err);
    expect(body.code).toBe('EMAIL_ALREADY_IN_USE');
    expect(JSON.stringify(body)).not.toContain('other-user');
    expect(JSON.stringify(body)).not.toContain('Owner@Hidden.COM');
    expect(prisma.employee.update).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        email: { equals: 'owner@hidden.com', mode: 'insensitive' },
        id: { not: 'u1' },
      },
      select: { id: true },
    }));
  });

  it('rolls back when the linked user email write fails after employee update', async () => {
    stubLoadedEmployee({ userId: 'u1', email: 'old@example.com' });
    let committed = false;
    rlsTransaction.withTransaction.mockImplementation(async (cb: (tx: typeof prisma) => Promise<unknown>) => {
      try {
        const result = await cb(prisma);
        committed = true;
        return result;
      } catch (err) {
        committed = false;
        throw err;
      }
    });
    prisma.employee.update.mockResolvedValue({ id: 'e1', email: 'new@example.com' });
    prisma.user.update.mockRejectedValue(new Error('write failed'));

    await expect(
      handler.execute({ employeeId: 'e1', email: 'new@example.com' } as any),
    ).rejects.toThrow('write failed');
    expect(committed).toBe(false);
    expect(prisma.employee.update).toHaveBeenCalled();
    expect(prisma.user.update).toHaveBeenCalled();
  });

  it('maps a unique-constraint race to 409 without a partial return', async () => {
    stubLoadedEmployee({ userId: 'u1' });
    prisma.employee.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['email'] },
      }),
    );

    const err = await handler.execute({ employeeId: 'e1', email: 'race@example.com' } as any).catch((e) => e);
    const body = conflictResponse(err);
    expect(body.code).toBe('EMAIL_ALREADY_IN_USE');
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('does not touch User when email is omitted', async () => {
    prisma.employee.findFirst.mockResolvedValue(createEmployee({ userId: 'u1' }));
    prisma.employee.update.mockResolvedValue({ id: 'e1', name: 'Jane' });

    await handler.execute({ employeeId: 'e1', nameEn: 'Jane' } as any);

    expect(prisma.employee.findFirst).toHaveBeenCalledTimes(1);
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.employee.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.not.objectContaining({ email: expect.anything() }),
    }));
  });
});
