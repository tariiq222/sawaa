import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { DeleteEmployeeExceptionHandler } from './delete-employee-exception.handler';

describe('DeleteEmployeeExceptionHandler', () => {
  let handler: DeleteEmployeeExceptionHandler;
  let prisma: { employeeAvailabilityException: { findFirst: jest.Mock; delete: jest.Mock } };

  beforeEach(async () => {
    prisma = { employeeAvailabilityException: { findFirst: jest.fn(), delete: jest.fn() } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeleteEmployeeExceptionHandler,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    handler = module.get<DeleteEmployeeExceptionHandler>(DeleteEmployeeExceptionHandler);
  });

  it('throws NotFoundException when no exception matches both ids', async () => {
    prisma.employeeAvailabilityException.findFirst.mockResolvedValue(null);

    await expect(
      handler.execute({
        exceptionId: '00000000-0000-0000-0000-000000000001',
        employeeId: '00000000-0000-0000-0000-000000000002',
      }),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.employeeAvailabilityException.delete).not.toHaveBeenCalled();
  });

  it('looks the exception up by both ids (cross-tenant safety)', async () => {
    prisma.employeeAvailabilityException.findFirst.mockResolvedValue(null);
    await expect(
      handler.execute({ exceptionId: 'ex-1', employeeId: 'emp-9' }),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.employeeAvailabilityException.findFirst).toHaveBeenCalledWith({
      where: { id: 'ex-1', employeeId: 'emp-9' },
    });
  });

  it('deletes the exception when found', async () => {
    prisma.employeeAvailabilityException.findFirst.mockResolvedValue({ id: 'ex-1' });
    prisma.employeeAvailabilityException.delete.mockResolvedValue(undefined);

    await handler.execute({ exceptionId: 'ex-1', employeeId: 'emp-9' });

    expect(prisma.employeeAvailabilityException.delete).toHaveBeenCalledWith({ where: { id: 'ex-1' } });
  });
});