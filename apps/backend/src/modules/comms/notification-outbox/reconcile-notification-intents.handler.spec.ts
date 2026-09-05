import { PrismaService } from '../../../infrastructure/database';
import { NotificationOutboxConfig } from './notification-outbox.config';
import { MaterializeNotificationIntentHandler } from './materialize-notification-intent.handler';
import { ReconcileNotificationIntentsHandler } from './reconcile-notification-intents.handler';

describe('ReconcileNotificationIntentsHandler', () => {
  it('materializes due pending and retry-wait intents and reports failures without stopping the page', async () => {
    const prisma = {
      notificationIntent: {
        findMany: jest.fn().mockResolvedValueOnce([
          { id: 'intent-1', status: 'PENDING', attempts: 0 },
          { id: 'intent-2', status: 'RETRY_WAIT', attempts: 1 },
        ]).mockResolvedValueOnce([]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const materialize = {
      execute: jest.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('temporary materialization failure')),
    };
    const handler = new ReconcileNotificationIntentsHandler(
      prisma as unknown as PrismaService,
      materialize as unknown as MaterializeNotificationIntentHandler,
      {} as NotificationOutboxConfig,
    );

    await expect(handler.execute()).resolves.toEqual({ examined: 2, changed: 1, failed: 1 });
    expect(materialize.execute).toHaveBeenNthCalledWith(1, 'intent-1');
    expect(materialize.execute).toHaveBeenNthCalledWith(2, 'intent-2');
    expect(prisma.notificationIntent.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'intent-2', status: 'RETRY_WAIT', attempts: 1 },
      data: expect.objectContaining({ status: 'RETRY_WAIT', attempts: { increment: 1 }, nextAttemptAt: expect.any(Date) }),
    }));
  });

  it('does not process future retry attempts', async () => {
    const prisma = { notificationIntent: { findMany: jest.fn().mockResolvedValueOnce([]) } };
    const materialize = { execute: jest.fn() };
    const handler = new ReconcileNotificationIntentsHandler(
      prisma as unknown as PrismaService,
      materialize as unknown as MaterializeNotificationIntentHandler,
      {} as NotificationOutboxConfig,
    );

    await expect(handler.execute()).resolves.toEqual({ examined: 0, changed: 0, failed: 0 });
    expect(materialize.execute).not.toHaveBeenCalled();
    expect(prisma.notificationIntent.findMany.mock.calls[0][0].where.status.in).toEqual(['PENDING', 'RETRY_WAIT']);
  });
});
