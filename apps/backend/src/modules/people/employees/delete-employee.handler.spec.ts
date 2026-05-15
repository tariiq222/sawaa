import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { DeleteEmployeeHandler } from './delete-employee.handler';
import { PrismaService } from '../../../infrastructure/database';

const buildPrisma = () => ({
  employee: { findFirst: jest.fn(), delete: jest.fn() },
  booking: { count: jest.fn() },
  groupSession: { count: jest.fn() },
  invoice: { count: jest.fn() },
  waitlistEntry: { count: jest.fn() },
  rating: { count: jest.fn() },
});

describe('DeleteEmployeeHandler', () => {
  let handler: DeleteEmployeeHandler;
  let prisma: ReturnType<typeof buildPrisma>;

  beforeEach(async () => {
    prisma = buildPrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [DeleteEmployeeHandler, { provide: PrismaService, useValue: prisma }],
    }).compile();
    handler = module.get<DeleteEmployeeHandler>(DeleteEmployeeHandler);
  });

  it('should throw NotFoundException when employee not found', async () => {
    prisma.employee.findFirst.mockResolvedValue(null);
    await expect(handler.execute({ employeeId: 'missing' })).rejects.toThrow(NotFoundException);
  });

  it('should throw ConflictException when active bookings exist', async () => {
    prisma.employee.findFirst.mockResolvedValue({ id: 'emp-1' });
    prisma.booking.count.mockResolvedValue(3);
    await expect(handler.execute({ employeeId: 'emp-1' })).rejects.toThrow(ConflictException);
  });

  it('should throw ConflictException when active group sessions exist', async () => {
    prisma.employee.findFirst.mockResolvedValue({ id: 'emp-1' });
    prisma.booking.count.mockResolvedValue(0);
    prisma.groupSession.count.mockResolvedValue(2);
    await expect(handler.execute({ employeeId: 'emp-1' })).rejects.toThrow(ConflictException);
  });

  it('should throw ConflictException when unpaid invoices exist', async () => {
    prisma.employee.findFirst.mockResolvedValue({ id: 'emp-1' });
    prisma.booking.count.mockResolvedValue(0);
    prisma.groupSession.count.mockResolvedValue(0);
    prisma.invoice.count.mockResolvedValue(1);
    await expect(handler.execute({ employeeId: 'emp-1' })).rejects.toThrow(ConflictException);
  });

  it('should throw ConflictException when waitlist entries exist', async () => {
    prisma.employee.findFirst.mockResolvedValue({ id: 'emp-1' });
    prisma.booking.count.mockResolvedValue(0);
    prisma.groupSession.count.mockResolvedValue(0);
    prisma.invoice.count.mockResolvedValue(0);
    prisma.waitlistEntry.count.mockResolvedValue(5);
    await expect(handler.execute({ employeeId: 'emp-1' })).rejects.toThrow(ConflictException);
  });

  it('should throw ConflictException when ratings exist', async () => {
    prisma.employee.findFirst.mockResolvedValue({ id: 'emp-1' });
    prisma.booking.count.mockResolvedValue(0);
    prisma.groupSession.count.mockResolvedValue(0);
    prisma.invoice.count.mockResolvedValue(0);
    prisma.waitlistEntry.count.mockResolvedValue(0);
    prisma.rating.count.mockResolvedValue(2);
    await expect(handler.execute({ employeeId: 'emp-1' })).rejects.toThrow(ConflictException);
  });

  it('should delete employee when no constraints', async () => {
    prisma.employee.findFirst.mockResolvedValue({ id: 'emp-1' });
    prisma.booking.count.mockResolvedValue(0);
    prisma.groupSession.count.mockResolvedValue(0);
    prisma.invoice.count.mockResolvedValue(0);
    prisma.waitlistEntry.count.mockResolvedValue(0);
    prisma.rating.count.mockResolvedValue(0);
    prisma.employee.delete.mockResolvedValue({ id: 'emp-1' });

    await handler.execute({ employeeId: 'emp-1' });
    expect(prisma.employee.delete).toHaveBeenCalledWith({ where: { id: 'emp-1' } });
  });
});
