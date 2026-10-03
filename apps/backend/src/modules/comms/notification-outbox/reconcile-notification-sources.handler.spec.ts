import { PrismaService } from '../../../infrastructure/database';
import { NotificationOutboxConfig } from './notification-outbox.config';
import { CaptureNotificationIntentHandler } from './capture-notification-intent.handler';
import { ReconcileNotificationSourcesHandler } from './reconcile-notification-sources.handler';

const envelope = (eventId: string, payload: Record<string, unknown>, version = 1) => ({
  eventId,
  source: 'domain',
  version,
  occurredAt: '2026-09-05T12:00:00.000Z',
  payload,
});

const enabled = {
  captureEnabled: true,
  cutoverAt: new Date('2026-09-05T00:00:00.000Z'),
  shouldCapture: jest.fn().mockReturnValue(true),
} as unknown as NotificationOutboxConfig;

function build(pages: unknown[][]) {
  const prisma = {
    $queryRaw: jest.fn(),
    notificationIntent: {
      findUnique: jest.fn().mockResolvedValue(null),
      createMany: jest.fn().mockImplementation(({ data }) => ({ count: data.length })),
    },
  };
  for (const page of pages) prisma.$queryRaw.mockResolvedValueOnce(page);
  const capture = { execute: jest.fn().mockResolvedValue('intent') };
  return {
    prisma,
    capture,
    handler: new ReconcileNotificationSourcesHandler(
      prisma as unknown as PrismaService,
      capture as unknown as CaptureNotificationIntentHandler,
      enabled,
    ),
  };
}

describe('ReconcileNotificationSourcesHandler', () => {
  it('recovers allowlisted pending/published sources using envelope identity and never republishes', async () => {
    const { handler, prisma, capture } = build([[
      { id: 'physical-1', eventType: 'bookings.booking.created', createdAt: new Date(), payload: envelope('event-1', { bookingId: 'booking-1', bookingNumber: 7, employeeId: 'employee-1' }) },
      { id: 'physical-2', eventType: 'people.client.enrolled', createdAt: new Date(), payload: envelope('event-2', { clientId: 'client-1', name: 'سارة', phone: '+966500000000' }) },
    ]]);

    await expect(handler.execute()).resolves.toEqual({ examined: 2, changed: 3, failed: 0 });
    expect(capture.execute).toHaveBeenCalledWith(expect.objectContaining({ sourceKey: 'domain-event:event-1', sourceOutboxId: 'physical-1' }));
    expect(capture.execute).toHaveBeenCalledWith(expect.objectContaining({ sourceKey: 'client-enrolled:client-1', sourceOutboxId: 'physical-2' }));
    expect((prisma as unknown as Record<string, unknown>).publish).toBeUndefined();
  });

  it('creates both stable consumer intents for enrollment recovery', async () => {
    const { handler, capture } = build([[
      { id: 'physical-1', eventType: 'people.client.enrolled', createdAt: new Date(), payload: envelope('event-1', { clientId: 'client-1', name: 'سارة' }) },
    ]]);

    await handler.execute();

    expect(capture.execute.mock.calls.map(([command]) => command.consumerKey)).toEqual(expect.arrayContaining([
      'comms.client-enrolled-client.v2',
      'comms.client-enrolled-staff.v2',
    ]));
  });

  it('durably records unsupported versions as DEAD receipts instead of retrying forever', async () => {
    const { handler, prisma, capture } = build([[
      { id: 'physical-old', eventType: 'bookings.booking.created', createdAt: new Date(), payload: envelope('event-old', { bookingId: 'booking-1' }, 99) },
    ]]);

    await expect(handler.execute()).resolves.toEqual({ examined: 1, changed: 1, failed: 0 });
    expect(capture.execute).not.toHaveBeenCalled();
    expect(prisma.notificationIntent.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: [expect.objectContaining({ status: 'DEAD', sourceOutboxId: 'physical-old', payloadVersion: 99 })],
      skipDuplicates: true,
    }));
  });

  it.each([
    ['people.client.enrolled', { name: 'سارة' }, 2],
    ['bookings.booking.created', { bookingNumber: 7 }, 1],
    ['bookings.booking.cancelled', { bookingId: 'booking-1', clientId: 'client-1', reason: 42 }, 2],
  ])('durably rejects semantically invalid %s payloads', async (eventType, payload, expectedReceipts) => {
    const { handler, prisma, capture } = build([[
      { id: 'physical-invalid', eventType, createdAt: new Date(), payload: envelope('event-invalid', payload) },
    ]]);

    await expect(handler.execute()).resolves.toEqual({
      examined: 1,
      changed: expectedReceipts,
      failed: 0,
    });
    expect(capture.execute).not.toHaveBeenCalled();
    expect(prisma.notificationIntent.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.arrayContaining([
        expect.objectContaining({
          sourceOutboxId: 'physical-invalid',
          status: 'DEAD',
          payload: expect.objectContaining({ reason: 'INVALID_PAYLOAD' }),
        }),
      ]),
      skipDuplicates: true,
    }));
  });

  it('keyset-pages missing source receipts beyond the first hundred', async () => {
    const first = Array.from({ length: 100 }, (_, index) => ({
      id: `physical-${String(index).padStart(3, '0')}`,
      eventType: 'bookings.booking.created',
      createdAt: new Date(),
      payload: envelope(`event-${index}`, { bookingId: `booking-${index}` }),
    }));
    const last = { id: 'physical-100', eventType: 'bookings.booking.created', createdAt: new Date(), payload: envelope('event-100', { bookingId: 'booking-100' }) };
    const { handler, prisma, capture } = build([first, [last]]);

    await expect(handler.execute()).resolves.toMatchObject({ examined: 101, changed: 101 });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
    expect(capture.execute).toHaveBeenCalledTimes(101);
  });

  it('does nothing when capture is paused', async () => {
    const { prisma, capture } = build([]);
    const handler = new ReconcileNotificationSourcesHandler(
      prisma as unknown as PrismaService,
      capture as unknown as CaptureNotificationIntentHandler,
      { captureEnabled: false, cutoverAt: null } as NotificationOutboxConfig,
    );

    await expect(handler.execute()).resolves.toEqual({ examined: 0, changed: 0, failed: 0 });
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });
});

it('preserves center cancellation money and origin for client and staff recovery', async () => {
  const centerCancellation = { version: 1, initiatedBy: 'CENTER', reason: 'Program cancelled', refund: { refundAmount: 2500 }, allocations: [] };
  const { handler, capture } = build([[{ id: 'physical-center', eventType: 'bookings.booking.cancelled', createdAt: new Date(), payload: envelope('center-1', { bookingId: 'b1', clientId: 'c1', reason: 'SYSTEM_EXPIRED', centerCancellation }) }]]);
  await handler.execute();
  expect(capture.execute).toHaveBeenCalledTimes(2);
  for (const [command] of capture.execute.mock.calls) expect(command.payload.centerCancellation).toEqual(centerCancellation);
});
