import { Test, TestingModule } from '@nestjs/testing';
import { ContactMessageStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { ListContactMessagesHandler } from './list-contact-messages.handler';

describe('ListContactMessagesHandler', () => {
  let handler: ListContactMessagesHandler;
  let prisma: { contactMessage: { findMany: jest.Mock; count: jest.Mock } };

  beforeEach(async () => {
    prisma = { contactMessage: { findMany: jest.fn(), count: jest.fn() } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListContactMessagesHandler,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    handler = module.get<ListContactMessagesHandler>(ListContactMessagesHandler);
  });

  it('passes the status filter through to the where clause', async () => {
    prisma.contactMessage.findMany.mockResolvedValue([]);
    prisma.contactMessage.count.mockResolvedValue(0);

    await handler.execute({ status: ContactMessageStatus.NEW, page: 1, limit: 10 });

    expect(prisma.contactMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: ContactMessageStatus.NEW } }),
    );
    expect(prisma.contactMessage.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: ContactMessageStatus.NEW } }),
    );
  });

  it('uses an empty where clause when no status filter is supplied', async () => {
    prisma.contactMessage.findMany.mockResolvedValue([]);
    prisma.contactMessage.count.mockResolvedValue(0);

    await handler.execute({ page: 2, limit: 25 });

    expect(prisma.contactMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {}, skip: 25, take: 25, orderBy: { createdAt: 'desc' } }),
    );
  });

  it('returns the paginated shape with meta block', async () => {
    prisma.contactMessage.findMany.mockResolvedValue([{ id: 'm1' }, { id: 'm2' }]);
    prisma.contactMessage.count.mockResolvedValue(7);

    const result = await handler.execute({ page: 1, limit: 2 });

    expect(result.items).toHaveLength(2);
    expect(result.meta).toEqual({
      page: 1,
      limit: 2,
      total: 7,
      totalPages: 4,
      hasNextPage: true,
      hasPreviousPage: false,
    });
  });
});