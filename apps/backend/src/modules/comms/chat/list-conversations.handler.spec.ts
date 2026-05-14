import { ListConversationsHandler } from './list-conversations.handler';
import type { PrismaService } from '../../../infrastructure/database';

const buildPrisma = () => ({
  chatConversation: {
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
  },
});

describe('ListConversationsHandler', () => {
  it('returns paginated conversations for a client', async () => {
    const prisma = buildPrisma();
    prisma.chatConversation.findMany.mockResolvedValue([{ id: 'conv-1' }]);
    prisma.chatConversation.count.mockResolvedValue(1);
    const handler = new ListConversationsHandler(prisma as unknown as PrismaService);
    const result = await handler.execute({ clientId: 'client-1', page: 1, limit: 20 });
    expect(result.items).toHaveLength(1);
    expect(result.meta.total).toBe(1);
  });
});
