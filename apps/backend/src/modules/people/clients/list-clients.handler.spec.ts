import { Test, TestingModule } from '@nestjs/testing';
import { ClientSource } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { ListClientsHandler } from './list-clients.handler';

describe('ListClientsHandler', () => {
  let handler: ListClientsHandler;
  let prisma: PrismaService;

  const mockClient = (overrides: Partial<any> = {}) => ({
    id: 'client-1',
    name: 'John Doe',
    firstName: 'John',
    lastName: 'Doe',
    phone: '+966501234567',
    email: 'john@example.com',
    gender: 'MALE',
    accountType: 'FULL',
    isActive: true,
    source: 'WEB',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    deletedAt: null,
    organizationId: 'org-1',
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListClientsHandler,
        {
          provide: PrismaService,
          useValue: {
            client: {
              findMany: jest.fn(),
              count: jest.fn(),
            },
            booking: {
              findMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    handler = module.get<ListClientsHandler>(ListClientsHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('returns paginated list with correct structure', async () => {
    const client = mockClient();
    (prisma.client.findMany as jest.Mock).mockResolvedValue([client]);
    (prisma.client.count as jest.Mock).mockResolvedValue(1);
    (prisma.booking.findMany as jest.Mock).mockResolvedValue([]);

    const result = await handler.execute({ page: 1, limit: 10 });

    expect(result.items).toHaveLength(1);
    expect(result.meta.total).toBe(1);
    expect(result.meta.page).toBe(1);
    expect(result.meta.perPage).toBe(10);
  });

  it('applies isActive filter', async () => {
    (prisma.client.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.client.count as jest.Mock).mockResolvedValue(0);
    (prisma.booking.findMany as jest.Mock).mockResolvedValue([]);

    await handler.execute({ page: 1, limit: 10, isActive: true });

    expect(prisma.client.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: true }),
      }),
    );
    expect(prisma.client.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: true }),
      }),
    );
  });

  it('applies gender filter', async () => {
    (prisma.client.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.client.count as jest.Mock).mockResolvedValue(0);
    (prisma.booking.findMany as jest.Mock).mockResolvedValue([]);

    await handler.execute({ page: 1, limit: 10, gender: 'MALE' });

    expect(prisma.client.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ gender: 'MALE' }),
      }),
    );
  });

  it('applies source filter', async () => {
    (prisma.client.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.client.count as jest.Mock).mockResolvedValue(0);
    (prisma.booking.findMany as jest.Mock).mockResolvedValue([]);

    await handler.execute({ page: 1, limit: 10, source: ClientSource.ONLINE });

    expect(prisma.client.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ source: 'WEB' }),
      }),
    );
  });

  it('applies search filter (OR on name, firstName, lastName, phone, email)', async () => {
    (prisma.client.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.client.count as jest.Mock).mockResolvedValue(0);
    (prisma.booking.findMany as jest.Mock).mockResolvedValue([]);

    await handler.execute({ page: 1, limit: 10, search: 'john' });

    expect(prisma.client.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { name: { contains: 'john', mode: 'insensitive' } },
            { firstName: { contains: 'john', mode: 'insensitive' } },
            { lastName: { contains: 'john', mode: 'insensitive' } },
            { phone: { contains: 'john', mode: 'insensitive' } },
            { email: { contains: 'john', mode: 'insensitive' } },
          ],
        }),
      }),
    );
  });

  it('search undefined does not add OR clause', async () => {
    (prisma.client.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.client.count as jest.Mock).mockResolvedValue(0);
    (prisma.booking.findMany as jest.Mock).mockResolvedValue([]);

    await handler.execute({ page: 1, limit: 10 });

    const findManyCall = (prisma.client.findMany as jest.Mock).mock.calls[0][0];
    expect(findManyCall.where.OR).toBeUndefined();
  });

  it('empty clientIds returns empty booking summaries', async () => {
    (prisma.client.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.client.count as jest.Mock).mockResolvedValue(0);
    (prisma.booking.findMany as jest.Mock).mockResolvedValue([]);

    const result = await handler.execute({ page: 1, limit: 10 });

    expect(result.items).toHaveLength(0);
    expect(prisma.booking.findMany).not.toHaveBeenCalled();
  });

  it('loadBookingSummaries returns last and next bookings correctly', async () => {
    const now = new Date();
    const pastBooking = {
      id: 'b-past',
      clientId: 'client-1',
      scheduledAt: new Date(now.getTime() - 86400000),
      status: 'COMPLETED',
    };
    const futureBooking = {
      id: 'b-future',
      clientId: 'client-1',
      scheduledAt: new Date(now.getTime() + 86400000),
      status: 'CONFIRMED',
    };

    (prisma.client.findMany as jest.Mock).mockResolvedValue([mockClient()]);
    (prisma.client.count as jest.Mock).mockResolvedValue(1);
    (prisma.booking.findMany as jest.Mock)
      .mockResolvedValueOnce([pastBooking])
      .mockResolvedValueOnce([futureBooking]);

    const result = await handler.execute({ page: 1, limit: 10 });

    expect(result.items[0].lastBooking).toEqual({
      id: 'b-past',
      date: pastBooking.scheduledAt.toISOString(),
      status: 'COMPLETED',
    });
    expect(result.items[0].nextBooking).toEqual({
      id: 'b-future',
      date: futureBooking.scheduledAt.toISOString(),
      status: 'CONFIRMED',
    });
  });

  it('loadBookingSummaries returns empty when no clientIds', async () => {
    (prisma.client.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.client.count as jest.Mock).mockResolvedValue(0);

    const result = await handler.execute({ page: 1, limit: 10 });

    expect(result.items).toHaveLength(0);
    expect(prisma.booking.findMany).not.toHaveBeenCalled();
  });

  it('pagination (skip/take) works', async () => {
    (prisma.client.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.client.count as jest.Mock).mockResolvedValue(100);
    (prisma.booking.findMany as jest.Mock).mockResolvedValue([]);

    await handler.execute({ page: 3, limit: 20 });

    expect(prisma.client.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 40,
        take: 20,
      }),
    );
  });

  it('total count returned', async () => {
    (prisma.client.findMany as jest.Mock).mockResolvedValue([mockClient(), mockClient({ id: 'client-2' })]);
    (prisma.client.count as jest.Mock).mockResolvedValue(42);
    (prisma.booking.findMany as jest.Mock).mockResolvedValue([]);

    const result = await handler.execute({ page: 1, limit: 10 });

    expect(result.meta.total).toBe(42);
    expect(result.meta.totalPages).toBe(5);
    expect(result.meta.hasNextPage).toBe(true);
  });
});
