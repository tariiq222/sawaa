import { PrismaService } from '../../../infrastructure/database';
import { ResolveNotificationIntentOwnershipHandler } from './resolve-notification-intent-ownership.handler';

describe('ResolveNotificationIntentOwnershipHandler', () => {
  it('returns the existing intent id for a source and consumer pair', async () => {
    const prisma = {
      notificationIntent: {
        findUnique: jest.fn().mockResolvedValue({ id: 'intent-owned' }),
      },
    };
    const handler = new ResolveNotificationIntentOwnershipHandler(prisma as unknown as PrismaService);

    await expect(
      handler.execute({ sourceKey: 'domain-event:event-1', consumerKey: 'comms.booking-created-staff.v2' }),
    ).resolves.toBe('intent-owned');
    expect(prisma.notificationIntent.findUnique).toHaveBeenCalledWith({
      where: {
        sourceKey_consumerKey: {
          sourceKey: 'domain-event:event-1',
          consumerKey: 'comms.booking-created-staff.v2',
        },
      },
      select: { id: true },
    });
  });

  it('returns null when no v2 intent owns the source yet', async () => {
    const prisma = { notificationIntent: { findUnique: jest.fn().mockResolvedValue(null) } };
    const handler = new ResolveNotificationIntentOwnershipHandler(prisma as unknown as PrismaService);

    await expect(
      handler.execute({ sourceKey: 'domain-event:event-2', consumerKey: 'comms.booking-cancelled-client.v2' }),
    ).resolves.toBeNull();
  });
});
