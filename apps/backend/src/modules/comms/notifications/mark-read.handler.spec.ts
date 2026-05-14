import { MarkReadHandler } from './mark-read.handler';
import type { PrismaService } from '../../../infrastructure/database';

const buildPrisma = () => ({
  notification: {
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
  },
});

describe('MarkReadHandler', () => {
  it('marks all notifications read for a recipient', async () => {
    const prisma = buildPrisma();
    const handler = new MarkReadHandler(prisma as unknown as PrismaService);
    await handler.execute({ organizationId: 'org-1', recipientId: 'client-1' });
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', recipientId: 'client-1', isRead: false },
      data: { isRead: true, readAt: expect.any(Date) },
    });
  });

  it('marks single notification read when notificationId provided', async () => {
    const prisma = buildPrisma();
    const handler = new MarkReadHandler(prisma as unknown as PrismaService);
    await handler.execute({ organizationId: 'org-1', recipientId: 'client-1', notificationId: 'notif-1' });
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', recipientId: 'client-1', isRead: false, id: 'notif-1' },
      data: { isRead: true, readAt: expect.any(Date) },
    });
  });
});
