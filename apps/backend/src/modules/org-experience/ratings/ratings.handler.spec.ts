import { BadRequestException, ConflictException } from '@nestjs/common';
import { SubmitRatingHandler } from './submit-rating.handler';
import { ListRatingsHandler } from './list-ratings.handler';

const mockRating = {
  id: 'rating-1',
  bookingId: 'booking-1',
  clientId: 'client-1',
  employeeId: 'emp-1',
  score: 5,
  comment: 'ممتاز',
  isPublic: false,
  createdAt: new Date(),
};

const mockClient = { id: 'client-1', name: 'سارة' };

const buildPrisma = () => {
  const prisma = {
    rating: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(mockRating),
      findMany: jest.fn().mockResolvedValue([mockRating]),
      count: jest.fn().mockResolvedValue(1),
    },
    client: {
      findMany: jest.fn().mockResolvedValue([mockClient]),
    },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation((fn: (tx: unknown) => Promise<unknown>) => fn(prisma));
  return prisma;
};

const validDto = { bookingId: 'booking-1', clientId: 'client-1', employeeId: 'emp-1', score: 5 };

describe('SubmitRatingHandler', () => {
  it('creates rating', async () => {
    const prisma = buildPrisma();
    const handler = new SubmitRatingHandler(prisma as never);
    const result = await handler.execute(validDto);
    expect(prisma.rating.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ bookingId: 'booking-1', score: 5 }) }),
    );
    expect(result.score).toBe(5);
  });

  it('throws BadRequestException for score outside 1–5', async () => {
    const prisma = buildPrisma();
    const handler = new SubmitRatingHandler(prisma as never);
    await expect(handler.execute({ ...validDto, score: 6 })).rejects.toThrow(BadRequestException);
    await expect(handler.execute({ ...validDto, score: 0 })).rejects.toThrow(BadRequestException);
  });

  it('throws ConflictException when rating already exists', async () => {
    const prisma = buildPrisma();
    prisma.rating.findUnique = jest.fn().mockResolvedValue(mockRating);
    const handler = new SubmitRatingHandler(prisma as never);
    await expect(handler.execute(validDto)).rejects.toThrow(ConflictException);
  });
});

describe('ListRatingsHandler', () => {
  it('returns paginated ratings', async () => {
    const prisma = buildPrisma();
    const handler = new ListRatingsHandler(prisma as never, { withTransaction: jest.fn((fn: any) => fn(prisma)) } as never);
    const result = await handler.execute({});
    expect(prisma.rating.findMany).toHaveBeenCalled();
    expect(result.items).toHaveLength(1);
    expect(result.meta.total).toBe(1);
  });

  it('enriches items with the batched client lookup', async () => {
    const prisma = buildPrisma();
    const handler = new ListRatingsHandler(prisma as never, { withTransaction: jest.fn((fn: any) => fn(prisma)) } as never);
    const result = await handler.execute({});
    // Batched lookup selects only id + name, scoped to the de-duped clientIds in the page.
    expect(prisma.client.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['client-1'] } },
      select: { id: true, name: true },
    });
    expect(result.items[0].client).toEqual(mockClient);
  });

  it('falls back to null client when no matching client row exists', async () => {
    const prisma = buildPrisma();
    (prisma.client.findMany as jest.Mock).mockResolvedValue([]);
    const handler = new ListRatingsHandler(prisma as never, { withTransaction: jest.fn((fn: any) => fn(prisma)) } as never);
    const result = await handler.execute({});
    expect(result.items[0].client).toBeNull();
  });

  it('filters by employeeId', async () => {
    const prisma = buildPrisma();
    const handler = new ListRatingsHandler(prisma as never, { withTransaction: jest.fn((fn: any) => fn(prisma)) } as never);
    await handler.execute({ employeeId: 'emp-1' });
    const call = (prisma.rating.findMany as jest.Mock).mock.calls[0][0];
    expect(call.where.employeeId).toBe('emp-1');
  });
});
