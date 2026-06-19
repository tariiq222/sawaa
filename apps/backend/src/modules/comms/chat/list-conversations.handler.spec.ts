import { Test, TestingModule } from '@nestjs/testing';
import { ListConversationsHandler } from './list-conversations.handler';
import { PrismaService } from '../../../infrastructure/database';

describe('ListConversationsHandler', () => {
  let handler: ListConversationsHandler;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      chatConversation: { findMany: jest.fn(), count: jest.fn() },
      client: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ListConversationsHandler, { provide: PrismaService, useValue: prisma }],
    }).compile();

    handler = module.get<ListConversationsHandler>(ListConversationsHandler);
  });

  it('should list conversations with filters', async () => {
    prisma.chatConversation.findMany.mockResolvedValue([]);
    prisma.chatConversation.count.mockResolvedValue(0);

    const result = await handler.execute({ clientId: 'c1', page: 1, limit: 10 });
    expect(prisma.chatConversation.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { clientId: 'c1' },
      skip: 0,
      take: 10,
    }));
    expect(result.meta.page).toBe(1);
  });

  it('should list conversations without filters', async () => {
    prisma.chatConversation.findMany.mockResolvedValue([]);
    prisma.chatConversation.count.mockResolvedValue(0);

    const result = await handler.execute({ page: 2, limit: 5 });
    expect(prisma.chatConversation.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {},
      skip: 5,
      take: 5,
    }));
    expect(result.meta.page).toBe(2);
  });
});
