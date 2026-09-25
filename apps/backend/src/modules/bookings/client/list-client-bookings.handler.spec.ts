import { Test, TestingModule } from '@nestjs/testing';
import { ListClientBookingsHandler, ClientBookingsTab } from './list-client-bookings.handler';
import { PrismaService } from '../../../infrastructure/database';

describe('ListClientBookingsHandler', () => {
  let handler: ListClientBookingsHandler;

  const baseBooking = {
    id: 'bk-1',
    clientId: 'cl-1',
    employeeId: 'emp-1',
    serviceId: 'svc-1',
    branchId: 'br-1',
    status: 'CONFIRMED',
    scheduledAt: new Date('2026-01-01T10:00:00Z'),
    endsAt: new Date('2026-01-01T11:00:00Z'),
    durationMins: 60,
    price: 150,
    currency: 'SAR',
    deliveryType: 'ONLINE',
    zoomJoinUrl: 'https://zoom.us/j/123',
    createdAt: new Date('2026-01-01T00:00:00Z'),
  };

  const mockPrisma = {
    booking: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    employee: { findMany: jest.fn() },
    service: { findMany: jest.fn() },
    branch: { findMany: jest.fn() },
    invoice: { findMany: jest.fn() },
    payment: { findMany: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListClientBookingsHandler,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    handler = module.get<ListClientBookingsHandler>(ListClientBookingsHandler);
  });

  it.each([ClientBookingsTab.Upcoming, ClientBookingsTab.Past, ClientBookingsTab.Cancelled])('filters %s before pagination and counts only that tab', async (tab) => {
    mockPrisma.booking.findMany.mockResolvedValue([]);
    mockPrisma.booking.count.mockResolvedValue(60);
    const result = await handler.execute('cl-1', 2, 50, tab);
    const where = mockPrisma.booking.findMany.mock.calls[0][0].where;
    expect(where.clientId).toBe('cl-1');
    expect(where.status).toEqual(tab === ClientBookingsTab.Cancelled ? { in: ['CANCELLED', 'CANCEL_REQUESTED'] } : { notIn: ['CANCELLED', 'CANCEL_REQUESTED'] });
    if (tab !== ClientBookingsTab.Cancelled) expect(where.scheduledAt).toEqual({ [tab === ClientBookingsTab.Upcoming ? 'gt' : 'lte']: expect.any(Date) });
    expect(mockPrisma.booking.findMany).toHaveBeenCalledWith(expect.objectContaining({ where, skip: 50, take: 50 }));
    expect(mockPrisma.booking.count).toHaveBeenCalledWith({ where });
    expect(result.total).toBe(60);
  });

  it('finds the next appointment before paging despite more than 50 historical rows', async () => {
    const rows = [
      ...Array.from({ length: 60 }, (_, i) => ({ ...baseBooking, id: `old-${i}`, scheduledAt: new Date(0) })),
      { ...baseBooking, id: 'next', scheduledAt: new Date(Date.now() + 86400000) },
      { ...baseBooking, id: 'later', scheduledAt: new Date(Date.now() + 172800000) },
      { ...baseBooking, id: 'cancelled', status: 'CANCELLED', scheduledAt: new Date(Date.now() + 1000) },
    ];
    const select = (where: { clientId: string; status?: { notIn: string[] }; scheduledAt?: { gt: Date } }) => rows.filter((row) => row.clientId === where.clientId && (!where.status || !where.status.notIn.includes(row.status)) && (!where.scheduledAt || row.scheduledAt > where.scheduledAt.gt));
    mockPrisma.booking.findMany.mockImplementation(async ({ where, skip, take }) => select(where).sort((a, b) => +a.scheduledAt - +b.scheduledAt).slice(skip, skip + take));
    mockPrisma.booking.count.mockImplementation(async ({ where }) => select(where).length);
    for (const relation of [mockPrisma.employee, mockPrisma.service, mockPrisma.branch, mockPrisma.invoice]) relation.findMany.mockResolvedValue([]);
    const result = await handler.execute('cl-1', 1, 1, ClientBookingsTab.Upcoming);
    expect(result.items.map((row) => row.id)).toEqual(['next']);
    expect(result.total).toBe(2);
    expect(mockPrisma.booking.findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }], take: 1 }));
  });

  it('returns empty list when no bookings', async () => {
    mockPrisma.booking.findMany.mockResolvedValue([]);
    mockPrisma.booking.count.mockResolvedValue(0);

    const result = await handler.execute('cl-1');

    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('maps serviceName to EN and serviceNameAr to AR', async () => {
    mockPrisma.booking.findMany.mockResolvedValue([baseBooking]);
    mockPrisma.booking.count.mockResolvedValue(1);
    mockPrisma.employee.findMany.mockResolvedValue([
      { id: 'emp-1', name: 'John', nameAr: 'جون' },
    ]);
    mockPrisma.service.findMany.mockResolvedValue([
      { id: 'svc-1', nameEn: 'Haircut', nameAr: 'قص شعر' },
    ]);
    mockPrisma.branch.findMany.mockResolvedValue([
      { id: 'br-1', nameEn: 'Main Branch', nameAr: 'الفرع الرئيسي' },
    ]);
    mockPrisma.invoice.findMany.mockResolvedValue([]);

    const result = await handler.execute('cl-1');

    expect(result.items).toHaveLength(1);
    const item = result.items[0];

    // EN field must hold English name
    expect(item.serviceName).toBe('Haircut');
    // AR field must hold Arabic name
    expect(item.serviceNameAr).toBe('قص شعر');

    expect(item.branchName).toBe('Main Branch');
    expect(item.branchNameAr).toBe('الفرع الرئيسي');

    expect(item.employeeName).toBe('John');
    expect(item.employeeNameAr).toBe('جون');

    // delivery fields come straight from the booking row
    expect(item.deliveryType).toBe('ONLINE');
    expect(item.zoomJoinUrl).toBe('https://zoom.us/j/123');
  });

  it('exposes invoice id/status when an invoice exists for the booking', async () => {
    mockPrisma.booking.findMany.mockResolvedValue([baseBooking]);
    mockPrisma.booking.count.mockResolvedValue(1);
    mockPrisma.employee.findMany.mockResolvedValue([]);
    mockPrisma.service.findMany.mockResolvedValue([]);
    mockPrisma.branch.findMany.mockResolvedValue([]);
    mockPrisma.invoice.findMany.mockResolvedValue([
      { id: 'inv-1', bookingId: 'bk-1', status: 'PAID' },
    ]);
    mockPrisma.payment.findMany.mockResolvedValue([
      { id: 'pay-1', invoiceId: 'inv-1', status: 'COMPLETED' },
    ]);

    const result = await handler.execute('cl-1');
    const item = result.items[0];

    expect(item.invoiceId).toBe('inv-1');
    expect(item.invoiceStatus).toBe('PAID');
    expect(item.paymentStatus).toBe('COMPLETED');
  });

  it('returns null invoice fields and null zoomJoinUrl when absent', async () => {
    mockPrisma.booking.findMany.mockResolvedValue([
      { ...baseBooking, deliveryType: 'IN_PERSON', zoomJoinUrl: null },
    ]);
    mockPrisma.booking.count.mockResolvedValue(1);
    mockPrisma.employee.findMany.mockResolvedValue([]);
    mockPrisma.service.findMany.mockResolvedValue([]);
    mockPrisma.branch.findMany.mockResolvedValue([]);
    mockPrisma.invoice.findMany.mockResolvedValue([]);

    const result = await handler.execute('cl-1');
    const item = result.items[0];

    expect(item.invoiceId).toBeNull();
    expect(item.invoiceStatus).toBeNull();
    expect(item.deliveryType).toBe('IN_PERSON');
    expect(item.zoomJoinUrl).toBeNull();
  });

  it('falls back to empty string for missing EN service name', async () => {
    mockPrisma.booking.findMany.mockResolvedValue([baseBooking]);
    mockPrisma.booking.count.mockResolvedValue(1);
    mockPrisma.employee.findMany.mockResolvedValue([]);
    mockPrisma.service.findMany.mockResolvedValue([]);
    mockPrisma.branch.findMany.mockResolvedValue([]);
    mockPrisma.invoice.findMany.mockResolvedValue([]);

    const result = await handler.execute('cl-1');
    const item = result.items[0];

    expect(item.serviceName).toBe('');
    expect(item.serviceNameAr).toBeNull();
    expect(item.branchName).toBe('');
    expect(item.branchNameAr).toBeNull();
  });

  it('respects pagination parameters', async () => {
    mockPrisma.booking.findMany.mockResolvedValue([]);
    mockPrisma.booking.count.mockResolvedValue(25);

    const result = await handler.execute('cl-1', 3, 5);

    expect(result.page).toBe(3);
    expect(result.pageSize).toBe(5);
    expect(result.total).toBe(25);
    expect(mockPrisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 5 }),
    );
  });
});
