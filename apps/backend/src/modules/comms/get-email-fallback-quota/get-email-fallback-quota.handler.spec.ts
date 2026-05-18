import { GetEmailFallbackQuotaHandler } from './get-email-fallback-quota.handler';

describe('GetEmailFallbackQuotaHandler', () => {
  let handler: GetEmailFallbackQuotaHandler;
  let prismaMock: { notificationDeliveryLog: { count: jest.Mock } };

  beforeEach(() => {
    prismaMock = {
      notificationDeliveryLog: { count: jest.fn().mockResolvedValue(5) },
    };
    handler = new GetEmailFallbackQuotaHandler(prismaMock as any);
  });

  it('returns used count from this month, limit -1, and periodStart', async () => {
    const result = await handler.execute();
    expect(result.used).toBe(5);
    expect(result.limit).toBe(-1);
    expect(result.periodStart).toMatch(/^\d{4}-\d{2}-01T/);
  });

  it('passes channel=EMAIL filter to prisma', async () => {
    await handler.execute();
    expect(prismaMock.notificationDeliveryLog.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ channel: 'EMAIL' }),
      }),
    );
  });
});
