import { RecordPaymentHandler } from './record-payment.handler';
import type { PrismaService } from '../../../../infrastructure/database';
import type { ZohoApiClient, ZohoIntegrationConfig } from '../../../../infrastructure/zoho';

describe('RecordPaymentHandler — tenant isolation + payment-mode mapping', () => {
  const TENANT_A = 'org-A';
  const TENANT_B = 'org-B';

  const config: ZohoIntegrationConfig = {
    refreshToken: 'rt',
    zohoOrganizationId: 'zoho-A',
    dataCenter: 'sa',
    webhookSecret: 'w',
    defaults: { sendOnCreate: false },
  };

  function makeHandler() {
    const findFirstOrThrow = jest.fn();
    const prisma = {
      payment: { findFirstOrThrow },
    } as unknown as PrismaService;
    const recordCustomerPayment = jest.fn().mockResolvedValue({ payment: { payment_id: 'p1' } });
    const api = { recordCustomerPayment } as unknown as ZohoApiClient;
    return {
      handler: new RecordPaymentHandler(prisma, api),
      findFirstOrThrow,
      recordCustomerPayment,
    };
  }

  it('reads the Payment row scoped to the caller organizationId', async () => {
    const { handler, findFirstOrThrow } = makeHandler();
    findFirstOrThrow.mockResolvedValue({
      id: 'pay-1',
      amount: 100,
      method: 'ONLINE_CARD',
      gatewayRef: 'moy_charge_1',
      processedAt: new Date('2026-05-06T00:00:00Z'),
      createdAt: new Date('2026-05-05T00:00:00Z'),
    });

    await handler.execute({
      organizationId: TENANT_A,
      config,
      zohoInvoiceId: 'zinv',
      zohoCustomerId: 'zc',
      paymentId: 'pay-1',
    });

    expect(findFirstOrThrow).toHaveBeenCalledWith({
      where: { id: 'pay-1', organizationId: TENANT_A },
      select: expect.any(Object),
    });
  });

  it('refuses to use a payment row from a different tenant (Prisma scoping safety net)', async () => {
    // Simulates Prisma's scoped findFirstOrThrow returning nothing because the
    // payment exists but belongs to a different tenant.
    const { handler, findFirstOrThrow } = makeHandler();
    findFirstOrThrow.mockRejectedValue(new Error('No Payment found'));

    await expect(
      handler.execute({
        organizationId: TENANT_B,
        config,
        zohoInvoiceId: 'zinv',
        zohoCustomerId: 'zc',
        paymentId: 'pay-1',
      }),
    ).rejects.toThrow('No Payment found');
  });

  it.each([
    ['ONLINE_CARD', 'creditcard'],
    ['BANK_TRANSFER', 'banktransfer'],
    ['CASH', 'cash'],
    ['COUPON', 'cash'],
  ])('maps Deqah PaymentMethod %s → Zoho payment_mode %s', async (deqah, zoho) => {
    const { handler, findFirstOrThrow, recordCustomerPayment } = makeHandler();
    findFirstOrThrow.mockResolvedValue({
      id: 'pay-1',
      amount: 50,
      method: deqah,
      gatewayRef: 'g_ref',
      processedAt: new Date('2026-05-06T00:00:00Z'),
      createdAt: new Date('2026-05-06T00:00:00Z'),
    });
    await handler.execute({
      organizationId: TENANT_A,
      config,
      zohoInvoiceId: 'zinv',
      zohoCustomerId: 'zc',
      paymentId: 'pay-1',
    });
    expect(recordCustomerPayment).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ payment_mode: zoho }),
    );
  });

  it('uses gatewayRef as Zoho reference_number when present, falls back to payment id', async () => {
    const { handler, findFirstOrThrow, recordCustomerPayment } = makeHandler();
    findFirstOrThrow.mockResolvedValue({
      id: 'pay-2',
      amount: 25,
      method: 'ONLINE_CARD',
      gatewayRef: null,
      processedAt: null,
      createdAt: new Date('2026-05-06T00:00:00Z'),
    });
    await handler.execute({
      organizationId: TENANT_A,
      config,
      zohoInvoiceId: 'zinv',
      zohoCustomerId: 'zc',
      paymentId: 'pay-2',
    });
    expect(recordCustomerPayment).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ reference_number: 'pay-2' }),
    );
  });
});
