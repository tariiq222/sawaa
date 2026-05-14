import { Test } from '@nestjs/testing';
import { ClsModule, ClsService } from 'nestjs-cls';
import { PaymentCapturedEventHandler } from './payment-captured.event-handler';
import { CreateZohoInvoiceHandler } from './create-invoice.handler';
import { ZohoConfigService } from '../zoho-config.service';
import { EventBusService } from '../../../../infrastructure/events';
import { TENANT_CLS_KEY } from '../../../../common/tenant/tenant.constants';

/**
 * The event handler is the most critical integration point. It runs OUTSIDE
 * any HTTP request, inside a BullMQ worker, with NO tenant CLS pre-populated.
 * If the handler ever forgets to set CLS before invoking the create-invoice
 * handler, scoped Prisma queries against `Invoice`, `Client`, etc. will
 * either throw (strict mode) or — far worse — silently fail open.
 */
describe('PaymentCapturedEventHandler — tenant isolation under BullMQ', () => {
  const TENANT_A = 'org-A';
  const TENANT_B = 'org-B';

  async function makeHandler() {
    const subscribe = jest.fn();
    const eventBus = { subscribe } as unknown as EventBusService;

    const configLoad = jest.fn();
    const config = { load: configLoad } as unknown as ZohoConfigService;

    const createInvoiceExecute = jest.fn().mockResolvedValue({
      zohoInvoiceLinkId: 'l1',
      zohoInvoiceId: 'zinv_1',
    });
    const createInvoice = {
      execute: createInvoiceExecute,
    } as unknown as CreateZohoInvoiceHandler;

    const mod = await Test.createTestingModule({
      imports: [ClsModule.forRoot({ global: true, middleware: { mount: false } })],
      providers: [
        PaymentCapturedEventHandler,
        { provide: EventBusService, useValue: eventBus },
        { provide: ZohoConfigService, useValue: config },
        { provide: CreateZohoInvoiceHandler, useValue: createInvoice },
      ],
    }).compile();

    const handler = mod.get(PaymentCapturedEventHandler);
    handler.register();
    const subscribeCall = subscribe.mock.calls[0]!;
    const eventName: string = subscribeCall[0];
    const callback: (envelope: { payload: unknown }) => Promise<void> = subscribeCall[1];

    return {
      handler,
      cls: mod.get(ClsService),
      configLoad,
      createInvoiceExecute,
      eventName,
      callback,
    };
  }

  it('subscribes to finance.payment.completed', async () => {
    const { eventName } = await makeHandler();
    expect(eventName).toBe('finance.payment.completed');
  });

  it('skips silently when payload has no organizationId (legacy producer)', async () => {
    const { callback, configLoad, createInvoiceExecute } = await makeHandler();
    await callback({
      payload: {
        paymentId: 'p1',
        invoiceId: 'i1',
        bookingId: 'b1',
        amount: 100,
        currency: 'SAR',
      },
    });
    expect(configLoad).not.toHaveBeenCalled();
    expect(createInvoiceExecute).not.toHaveBeenCalled();
  });

  it('skips silently when the tenant has not configured Zoho', async () => {
    const { callback, configLoad, createInvoiceExecute } = await makeHandler();
    configLoad.mockResolvedValue({ isConfigured: false, isActive: false });

    await callback({
      payload: {
        organizationId: TENANT_A,
        paymentId: 'p1',
        invoiceId: 'i1',
        bookingId: 'b1',
        amount: 100,
        currency: 'SAR',
      },
    });
    expect(createInvoiceExecute).not.toHaveBeenCalled();
  });

  it('skips silently when the integration row is inactive', async () => {
    const { callback, configLoad, createInvoiceExecute } = await makeHandler();
    configLoad.mockResolvedValue({
      isConfigured: true,
      isActive: false,
      config: {
        refreshToken: 'rt',
        zohoOrganizationId: 'z',
        dataCenter: 'sa',
        webhookSecret: 'w',
        defaults: { sendOnCreate: false },
      },
    });

    await callback({
      payload: {
        organizationId: TENANT_A,
        paymentId: 'p1',
        invoiceId: 'i1',
        bookingId: 'b1',
        amount: 100,
        currency: 'SAR',
      },
    });
    expect(createInvoiceExecute).not.toHaveBeenCalled();
  });

  it('SETS the tenant CLS to the payload organizationId before invoking create-invoice', async () => {
    const { callback, configLoad, createInvoiceExecute, cls } = await makeHandler();
    const cfg = {
      refreshToken: 'rt',
      zohoOrganizationId: 'z',
      dataCenter: 'sa' as const,
      webhookSecret: 'w',
      defaults: { sendOnCreate: false },
    };
    configLoad.mockResolvedValue({ isConfigured: true, isActive: true, config: cfg });

    let capturedTenantId: string | undefined;
    createInvoiceExecute.mockImplementation(async () => {
      const ctx = cls.get(TENANT_CLS_KEY);
      capturedTenantId = (ctx as { organizationId?: string } | undefined)?.organizationId;
      return { zohoInvoiceLinkId: 'l1', zohoInvoiceId: 'zinv_1' };
    });

    await callback({
      payload: {
        organizationId: TENANT_A,
        paymentId: 'p1',
        invoiceId: 'i1',
        bookingId: 'b1',
        amount: 100,
        currency: 'SAR',
      },
    });

    expect(capturedTenantId).toBe(TENANT_A);
    expect(createInvoiceExecute).toHaveBeenCalledWith({
      organizationId: TENANT_A,
      invoiceId: 'i1',
      paymentId: 'p1',
      config: cfg,
    });
  });

  it('does NOT leak CLS between two consecutive deliveries for different tenants', async () => {
    const { callback, configLoad, createInvoiceExecute, cls } = await makeHandler();
    configLoad.mockImplementation(async (orgId: string) => ({
      isConfigured: true,
      isActive: true,
      config: {
        refreshToken: `rt-${orgId}`,
        zohoOrganizationId: `zoho-${orgId}`,
        dataCenter: 'sa' as const,
        webhookSecret: 'w',
        defaults: { sendOnCreate: false },
      },
    }));

    const seen: Array<string | undefined> = [];
    createInvoiceExecute.mockImplementation(async () => {
      const ctx = cls.get(TENANT_CLS_KEY);
      seen.push((ctx as { organizationId?: string } | undefined)?.organizationId);
      return { zohoInvoiceLinkId: 'l1', zohoInvoiceId: 'zinv' };
    });

    await callback({
      payload: {
        organizationId: TENANT_A,
        paymentId: 'p1',
        invoiceId: 'i1',
        bookingId: 'b1',
        amount: 1,
        currency: 'SAR',
      },
    });
    await callback({
      payload: {
        organizationId: TENANT_B,
        paymentId: 'p2',
        invoiceId: 'i2',
        bookingId: 'b2',
        amount: 1,
        currency: 'SAR',
      },
    });

    expect(seen).toEqual([TENANT_A, TENANT_B]);

    // Outside cls.run, CLS must be empty — runtime safeguard against
    // a leak from the worker context into request contexts.
    const outside = cls.get(TENANT_CLS_KEY);
    expect(outside).toBeUndefined();
  });

  it('propagates errors so BullMQ retries (at-least-once delivery)', async () => {
    const { callback, configLoad, createInvoiceExecute } = await makeHandler();
    configLoad.mockResolvedValue({
      isConfigured: true,
      isActive: true,
      config: {
        refreshToken: 'rt',
        zohoOrganizationId: 'z',
        dataCenter: 'sa',
        webhookSecret: 'w',
        defaults: { sendOnCreate: false },
      },
    });
    createInvoiceExecute.mockRejectedValue(new Error('Zoho 500'));

    await expect(
      callback({
        payload: {
          organizationId: TENANT_A,
          paymentId: 'p1',
          invoiceId: 'i1',
          bookingId: 'b1',
          amount: 1,
          currency: 'SAR',
        },
      }),
    ).rejects.toThrow('Zoho 500');
  });
});
