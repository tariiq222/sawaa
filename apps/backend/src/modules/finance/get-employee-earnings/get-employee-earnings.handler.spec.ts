import { Prisma } from '@prisma/client';
import { GetEmployeeEarningsHandler } from './get-employee-earnings.handler';
import { PrismaService } from '../../../infrastructure/database';

describe('GetEmployeeEarningsHandler', () => {
  const mockPrisma = {
    employee: { findFirst: jest.fn() },
    invoice: { findMany: jest.fn() },
    booking: { findMany: jest.fn() },
    service: { findMany: jest.fn() },
  };

  const handler = new GetEmployeeEarningsHandler(mockPrisma as unknown as PrismaService);

  const range = { from: new Date('2026-01-01'), to: new Date('2026-01-31') };

  afterEach(() => jest.clearAllMocks());

  it('computes commission-based earnings for a single payment method', async () => {
    mockPrisma.employee.findFirst.mockResolvedValue({ commissionRate: new Prisma.Decimal('0.7') });
    mockPrisma.invoice.findMany.mockResolvedValue([
      { subtotal: 10000, total: 11500, bookingId: 'bk-1', payments: [{ amount: 11500, method: 'ONLINE_CARD' }] },
    ]);
    mockPrisma.booking.findMany.mockResolvedValue([{ id: 'bk-1', serviceId: 'svc-1' }]);
    mockPrisma.service.findMany.mockResolvedValue([{ id: 'svc-1', commissionRateOverride: null }]);

    const res = await handler.execute({ employeeId: 'employee-1', ...range });

    expect(res.totalEarningsHalalas).toBe(7000);
    expect(res.totalRevenueHalalas).toBe(10000);
    expect(res.invoiceCount).toBe(1);
    expect(res.byMethod).toEqual({ ONLINE_CARD: 7000 });
    expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ employeeId: 'employee-1' }) }),
    );
  });

  it('splits byMethod proportionally across multiple payment methods', async () => {
    mockPrisma.employee.findFirst.mockResolvedValue({ commissionRate: new Prisma.Decimal('0.8') });
    mockPrisma.invoice.findMany.mockResolvedValue([
      {
        subtotal: 20000,
        total: 23000,
        bookingId: 'bk-2',
        payments: [
          { amount: 11500, method: 'ONLINE_CARD' },
          { amount: 11500, method: 'CASH' },
        ],
      },
    ]);
    mockPrisma.booking.findMany.mockResolvedValue([{ id: 'bk-2', serviceId: 'svc-2' }]);
    mockPrisma.service.findMany.mockResolvedValue([{ id: 'svc-2', commissionRateOverride: null }]);

    const res = await handler.execute({ employeeId: 'employee-1', ...range });

    expect(res.totalEarningsHalalas).toBe(16000);
    expect(res.byMethod.ONLINE_CARD).toBe(8000);
    expect(res.byMethod.CASH).toBe(8000);
  });

  it('applies per-service commission override over the employee default', async () => {
    mockPrisma.employee.findFirst.mockResolvedValue({ commissionRate: new Prisma.Decimal('0.5') });
    mockPrisma.invoice.findMany.mockResolvedValue([
      { subtotal: 10000, total: 11500, bookingId: 'bk-3', payments: [{ amount: 11500, method: 'CASH' }] },
    ]);
    mockPrisma.booking.findMany.mockResolvedValue([{ id: 'bk-3', serviceId: 'svc-3' }]);
    mockPrisma.service.findMany.mockResolvedValue([
      { id: 'svc-3', commissionRateOverride: new Prisma.Decimal('0.9') },
    ]);

    const res = await handler.execute({ employeeId: 'employee-1', ...range });

    expect(res.totalEarningsHalalas).toBe(9000);
    expect(res.byMethod).toEqual({ CASH: 9000 });
  });

  it('returns zero totals when there are no invoices', async () => {
    mockPrisma.employee.findFirst.mockResolvedValue({ commissionRate: new Prisma.Decimal('0.7') });
    mockPrisma.invoice.findMany.mockResolvedValue([]);

    const res = await handler.execute({ employeeId: 'employee-1', ...range });

    expect(res.totalEarningsHalalas).toBe(0);
    expect(res.totalRevenueHalalas).toBe(0);
    expect(res.invoiceCount).toBe(0);
    expect(res.byMethod).toEqual({});
    expect(mockPrisma.booking.findMany).not.toHaveBeenCalled();
  });

  it('defaults to a 100% rate when the employee row is missing', async () => {
    mockPrisma.employee.findFirst.mockResolvedValue(null);
    mockPrisma.invoice.findMany.mockResolvedValue([
      { subtotal: 5000, total: 5750, bookingId: 'bk-4', payments: [{ amount: 5750, method: 'ONLINE_CARD' }] },
    ]);
    mockPrisma.booking.findMany.mockResolvedValue([{ id: 'bk-4', serviceId: 'svc-4' }]);
    mockPrisma.service.findMany.mockResolvedValue([{ id: 'svc-4', commissionRateOverride: null }]);

    const res = await handler.execute({ employeeId: 'employee-1', ...range });

    expect(res.totalEarningsHalalas).toBe(5000);
  });
});
