import { ListNotificationsHandler } from './list-notifications.handler';
import type { PrismaService } from '../../../infrastructure/database';

const buildPrisma = () => ({
  notification: {
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
  },
});

describe('ListNotificationsHandler', () => {
  it('returns paginated notifications', async () => {
    const prisma = buildPrisma();
    (prisma.notification.findMany as jest.Mock).mockResolvedValue([{ id: 'notif-1', isRead: false }]);
    (prisma.notification.count as jest.Mock).mockResolvedValue(1);
    const handler = new ListNotificationsHandler(prisma as unknown as PrismaService);
    const result = await handler.execute({ recipientId: 'client-1', page: 1, limit: 20 });
    expect(result.items).toHaveLength(1);
    expect(result.meta.total).toBe(1);
  });

  it('filters unread when unreadOnly=true', async () => {
    const prisma = buildPrisma();
    const handler = new ListNotificationsHandler(prisma as unknown as PrismaService);
    await handler.execute({ recipientId: 'client-1', unreadOnly: true, page: 1, limit: 20 });
    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ isRead: false }) }),
    );
  });
});
