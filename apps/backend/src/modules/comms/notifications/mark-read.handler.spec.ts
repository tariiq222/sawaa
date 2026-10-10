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
    await handler.execute({ recipientId: 'client-1' });
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { recipientId: 'client-1', isRead: false },
      data: { isRead: true, readAt: expect.any(Date) },
    });
  });

  it('marks single notification read when notificationId provided', async () => {
    const prisma = buildPrisma();
    const handler = new MarkReadHandler(prisma as unknown as PrismaService);
    await handler.execute({ recipientId: 'client-1', notificationId: 'notif-1' });
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { recipientId: 'client-1', isRead: false, id: 'notif-1' },
      data: { isRead: true, readAt: expect.any(Date) },
    });
  });
});

describe('MarkReadHandler outsider records', () => {
  it('cannot mark a different recipient notification read', async () => {
    const records = [{id:'outside', recipientId:'other', isRead:false}];
    const prisma: any = {notification:{updateMany: jest.fn(async ({where, data}) => {
      records.filter(r => r.id === where.id && r.recipientId === where.recipientId).forEach(r => Object.assign(r,data));
      return {count:0};
    })}};
    await new MarkReadHandler(prisma).execute({recipientId:'self', notificationId:'outside'});
    expect(records[0].isRead).toBe(false);
  });
});
