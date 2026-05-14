import { GetUnreadCountHandler } from './get-unread-count.handler';

describe('GetUnreadCountHandler', () => {
  const buildPrisma = () => ({
    notification: { count: jest.fn().mockResolvedValue(3) },
  });

  it('returns count of unread notifications for recipient', async () => {
    const prisma = buildPrisma();
    const result = await new GetUnreadCountHandler(prisma as never).execute({
      recipientId: 'user-1',
    });
    expect(result).toEqual({ count: 3 });
    expect(prisma.notification.count).toHaveBeenCalledWith({
      where: { recipientId: 'user-1', isRead: false },
    });
  });

  it('returns zero when no unread notifications exist', async () => {
    const prisma = buildPrisma();
    prisma.notification.count = jest.fn().mockResolvedValue(0);
    const result = await new GetUnreadCountHandler(prisma as never).execute({
      recipientId: 'user-1',
    });
    expect(result).toEqual({ count: 0 });
  });
});
