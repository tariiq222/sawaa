import { ReconcileSmsDeliveryReceiptsHandler } from './reconcile-sms-delivery-receipts.handler';

describe('ReconcileSmsDeliveryReceiptsHandler', () => {
  const prisma = {
    notificationDelivery: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    smsDelivery: {
      findUnique: jest.fn(),
    },
  };
  let handler: ReconcileSmsDeliveryReceiptsHandler;

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.notificationDelivery.findMany.mockResolvedValue([
      {
        id: 'delivery-sms-1',
        channel: 'SMS',
        status: 'ACCEPTED',
        providerName: 'TAQNYAT',
        providerMessageId: 'receipt-1',
      },
      {
        id: 'delivery-sms-2',
        channel: 'SMS',
        status: 'ACCEPTED',
        providerName: 'TAQNYAT',
        providerMessageId: 'receipt-2',
      },
    ]);
    prisma.smsDelivery.findUnique.mockResolvedValue(null);
    prisma.notificationDelivery.updateMany.mockResolvedValue({ count: 1 });
    handler = new ReconcileSmsDeliveryReceiptsHandler(prisma as never, {} as never);
  });

  it('reads existing SmsDelivery receipts and fences terminal delivery updates', async () => {
    prisma.smsDelivery.findUnique
      .mockResolvedValueOnce({ status: 'DELIVERED', providerMessageId: 'receipt-1' })
      .mockResolvedValueOnce({ status: 'FAILED', errorCode: 'UNDELIVERABLE' });

    const result = await handler.execute();

    expect(prisma.smsDelivery.findUnique).toHaveBeenNthCalledWith(1, {
      where: { providerMessageId: 'receipt-1' },
    });
    expect(prisma.notificationDelivery.updateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { id: 'delivery-sms-1', status: 'ACCEPTED', providerMessageId: 'receipt-1' },
        data: expect.objectContaining({ status: 'DELIVERED' }),
      }),
    );
    expect(prisma.notificationDelivery.updateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { id: 'delivery-sms-2', status: 'ACCEPTED', providerMessageId: 'receipt-2' },
        data: expect.objectContaining({ status: 'DEAD', outcomeReason: expect.any(String) }),
      }),
    );
    expect(result).toEqual({ examined: 2, changed: 2, failed: 0 });
  });

  it('ignores missing receipts and never changes webhook verification state', async () => {
    prisma.notificationDelivery.findMany.mockResolvedValue([
      {
        id: 'delivery-sms-pending',
        channel: 'SMS',
        status: 'ACCEPTED',
        providerName: 'TAQNYAT',
        providerMessageId: 'receipt-missing',
      },
    ]);
    prisma.smsDelivery.findUnique.mockResolvedValue(null);

    const result = await handler.execute();

    expect(prisma.notificationDelivery.updateMany).not.toHaveBeenCalled();
    expect(result).toEqual({ examined: 1, changed: 0, failed: 0 });
  });
});
