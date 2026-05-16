import { Test } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { EventBusService } from '../../../infrastructure/events';
import { CreateEmployeeHandler } from './create-employee.handler';

jest.mock('../../../infrastructure/events', () => ({
  EventBusService: jest.fn().mockImplementation(() => ({
    publish: jest.fn().mockResolvedValue(undefined),
  })),
}));

describe('CreateEmployeeHandler', () => {
  let handler: CreateEmployeeHandler;
  let prisma: any;
  let eventBus: any;

  beforeEach(async () => {
    prisma = {
      employee: { findFirst: jest.fn(), create: jest.fn() },
      $transaction: jest.fn(async (cb) => await cb(prisma)),
    };
    eventBus = { publish: jest.fn().mockResolvedValue(undefined) };

    const module = await Test.createTestingModule({
      providers: [
        CreateEmployeeHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: RlsTransactionService, useValue: { withTransaction: jest.fn((cb: any) => cb(prisma)) } },
        { provide: EventBusService, useValue: eventBus },
      ],
    }).compile();

    handler = module.get(CreateEmployeeHandler);
  });

  it('should be defined', () => expect(handler).toBeDefined());

  it('should throw when email already exists', async () => {
    prisma.employee.findFirst.mockResolvedValue({ id: 'e1' });
    await expect(handler.execute({ name: 'John', email: 'john@test.com' } as any)).rejects.toThrow(ConflictException);
  });

  it('should create employee with minimal data', async () => {
    prisma.employee.findFirst.mockResolvedValue(null);
    prisma.employee.create.mockResolvedValue({ id: 'e1', name: 'John', branches: [], services: [] });

    const result = await handler.execute({ name: 'John' } as any);
    expect(result.id).toBe('e1');
    expect(prisma.employee.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ name: 'John', branches: undefined, services: undefined }),
    }));
  });

  it('should create employee with branches and services', async () => {
    prisma.employee.findFirst.mockResolvedValue(null);
    prisma.employee.create.mockResolvedValue({ id: 'e2', name: 'Jane', branches: [{ branchId: 'b1' }], services: [{ serviceId: 's1' }] });

    const result = await handler.execute({ name: 'Jane', email: 'jane@test.com', branchIds: ['b1'], serviceIds: ['s1'] } as any);
    expect(prisma.employee.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        branches: { create: [{ branchId: 'b1' }] },
        services: { create: [{ serviceId: 's1' }] },
      }),
    }));
    expect(eventBus.publish).toHaveBeenCalled();
  });

  it('should not include branches when empty array', async () => {
    prisma.employee.findFirst.mockResolvedValue(null);
    prisma.employee.create.mockResolvedValue({ id: 'e3' });

    await handler.execute({ name: 'Bob', branchIds: [], serviceIds: [] } as any);
    const data = prisma.employee.create.mock.calls[0][0].data;
    expect(data.branches).toBeUndefined();
    expect(data.services).toBeUndefined();
  });
});
