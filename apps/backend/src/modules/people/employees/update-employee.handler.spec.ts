import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { EventBusService } from '../../../infrastructure/events';
import { UpdateEmployeeHandler } from './update-employee.handler';

function createEmployee(overrides?: Partial<any>) {
  return {
    id: 'e1',
    name: 'John',
    isActive: true,
    ...overrides,
  };
}

describe('UpdateEmployeeHandler', () => {
  let handler: UpdateEmployeeHandler;
  let prisma: any;
  let eventBus: any;

  beforeEach(async () => {
    prisma = {
      employee: { findFirst: jest.fn(), update: jest.fn() },
    };
    eventBus = { publish: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdateEmployeeHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: EventBusService, useValue: eventBus },
      ],
    }).compile();

    handler = module.get<UpdateEmployeeHandler>(UpdateEmployeeHandler);
  });

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
});
