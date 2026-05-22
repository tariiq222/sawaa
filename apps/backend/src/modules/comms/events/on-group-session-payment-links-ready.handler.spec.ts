import { OnGroupSessionPaymentLinksReadyHandler } from './on-group-session-payment-links-ready.handler';

const cfg = { get: (k: string) => (k === 'CLIENT_PAYMENT_URL_BASE' ? 'https://sawaa.net' : undefined) } as never;

const makeEnvelope = (paymentLinks: object[]) => ({
  payload: {
    groupSessionKey: 'emp-1:svc-1:2026-05-01T10:00:00.000Z',
    paymentLinks,
  },
});

const baseLink = (extras: Partial<{ clientEmail: string; clientPhone: string; clientName: string }> = {}) => ({
  bookingId: 'bk-1',
  clientId: 'cl-1',
  invoiceId: 'inv-1',
  amount: 200,
  currency: 'SAR',
  ...extras,
});

describe('OnGroupSessionPaymentLinksReadyHandler', () => {
  it('sends one notification per payment link', async () => {
    const notify = { execute: jest.fn().mockResolvedValue(undefined) };
    const pushTargets = { execute: jest.fn().mockResolvedValue({ pushEnabled: true, tokens: ['tok-1'] }) };
    const handler = new OnGroupSessionPaymentLinksReadyHandler(notify as never, pushTargets as never, cfg);
    await handler.handle(makeEnvelope([baseLink(), baseLink()]) as never);
    expect(notify.execute).toHaveBeenCalledTimes(2);
  });

  it('uses in-app + push when no contact info', async () => {
    const notify = { execute: jest.fn().mockResolvedValue(undefined) };
    const pushTargets = { execute: jest.fn().mockResolvedValue({ pushEnabled: true, tokens: ['tok-1'] }) };
    const handler = new OnGroupSessionPaymentLinksReadyHandler(notify as never, pushTargets as never, cfg);
    await handler.handle(makeEnvelope([baseLink()]) as never);
    expect(notify.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        channels: ['in-app', 'push'],
        type: 'PAYMENT_REMINDER',
      }),
    );
  });

  it('adds email channel + slug + vars when clientEmail present', async () => {
    const notify = { execute: jest.fn().mockResolvedValue(undefined) };
    const pushTargets = { execute: jest.fn().mockResolvedValue({ pushEnabled: false, tokens: [] }) };
    const handler = new OnGroupSessionPaymentLinksReadyHandler(notify as never, pushTargets as never, cfg);
    await handler.handle(
      makeEnvelope([baseLink({ clientEmail: 'a@b.com', clientName: 'سارة' })]) as never,
    );
    expect(notify.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        channels: expect.arrayContaining(['email']),
        emailTemplateSlug: 'group-session-payment-due',
        recipientEmail: 'a@b.com',
        emailVars: expect.objectContaining({
          client_name: 'سارة',
          amount: '200',
          currency: 'SAR',
          payment_url: 'https://sawaa.net/invoices/inv-1',
        }),
      }),
    );
  });

  it('adds sms channel when clientPhone present', async () => {
    const notify = { execute: jest.fn().mockResolvedValue(undefined) };
    const pushTargets = { execute: jest.fn().mockResolvedValue({ pushEnabled: false, tokens: [] }) };
    const handler = new OnGroupSessionPaymentLinksReadyHandler(notify as never, pushTargets as never, cfg);
    await handler.handle(makeEnvelope([baseLink({ clientPhone: '+966500000000' })]) as never);
    expect(notify.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        channels: expect.arrayContaining(['sms']),
        recipientPhone: '+966500000000',
      }),
    );
  });

  it('passes invoiceId and bookingId in metadata', async () => {
    const notify = { execute: jest.fn().mockResolvedValue(undefined) };
    const pushTargets = { execute: jest.fn().mockResolvedValue({ pushEnabled: true, tokens: ['tok-1'] }) };
    const handler = new OnGroupSessionPaymentLinksReadyHandler(notify as never, pushTargets as never, cfg);
    await handler.handle(makeEnvelope([baseLink()]) as never);
    expect(notify.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ invoiceId: 'inv-1', bookingId: 'bk-1' }),
      }),
    );
  });

  it('continues notifying remaining clients when one fails', async () => {
    const notify = {
      execute: jest.fn().mockRejectedValueOnce(new Error('push failed')).mockResolvedValueOnce(undefined),
    };
    const pushTargets = { execute: jest.fn().mockResolvedValue({ pushEnabled: true, tokens: ['tok-1'] }) };
    const handler = new OnGroupSessionPaymentLinksReadyHandler(notify as never, pushTargets as never, cfg);
    await expect(handler.handle(makeEnvelope([baseLink(), baseLink()]) as never)).resolves.toBeUndefined();
    expect(notify.execute).toHaveBeenCalledTimes(2);
  });

  it('subscribes to the right event on register()', () => {
    const notify = { execute: jest.fn() };
    const pushTargets = { execute: jest.fn() };
    const eventBus = { subscribe: jest.fn() };
    const handler = new OnGroupSessionPaymentLinksReadyHandler(notify as never, pushTargets as never, cfg);
    handler.register(eventBus as never);
    expect(eventBus.subscribe).toHaveBeenCalledWith(
      'group_session.payment_links_ready',
      expect.any(Function),
    );
  });
});
