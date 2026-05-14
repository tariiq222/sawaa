import { OnGroupSessionPaymentLinksReadyHandler } from './on-group-session-payment-links-ready.handler';

const makeEnvelope = (paymentLinks: object[]) => ({
  payload: {
    groupSessionKey: 'emp-1:svc-1:2026-05-01T10:00:00.000Z',
    paymentLinks,
  },
});

const twoLinks = [
  { bookingId: 'bk-1', clientId: 'cl-1', invoiceId: 'inv-1', amount: 200, currency: 'SAR' },
  { bookingId: 'bk-2', clientId: 'cl-2', invoiceId: 'inv-2', amount: 200, currency: 'SAR' },
];

describe('OnGroupSessionPaymentLinksReadyHandler', () => {
  it('sends a PAYMENT_REMINDER notification to each client', async () => {
    const notify = { execute: jest.fn().mockResolvedValue(undefined) };
    const pushTargets = { execute: jest.fn().mockResolvedValue({ pushEnabled: true, tokens: ['tok-1'] }) };
    const handler = new OnGroupSessionPaymentLinksReadyHandler(notify as never, pushTargets as never);
    await handler.handle(makeEnvelope(twoLinks) as never);
    expect(notify.execute).toHaveBeenCalledTimes(2);
  });

  it('sends in-app and push channels', async () => {
    const notify = { execute: jest.fn().mockResolvedValue(undefined) };
    const pushTargets = { execute: jest.fn().mockResolvedValue({ pushEnabled: true, tokens: ['tok-1'] }) };
    const handler = new OnGroupSessionPaymentLinksReadyHandler(notify as never, pushTargets as never);
    await handler.handle(makeEnvelope([twoLinks[0]]) as never);
    expect(notify.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        channels: expect.arrayContaining(['in-app', 'push']),
        type: 'PAYMENT_REMINDER',
      }),
    );
  });

  it('passes invoiceId and bookingId in metadata', async () => {
    const notify = { execute: jest.fn().mockResolvedValue(undefined) };
    const pushTargets = { execute: jest.fn().mockResolvedValue({ pushEnabled: true, tokens: ['tok-1'] }) };
    const handler = new OnGroupSessionPaymentLinksReadyHandler(notify as never, pushTargets as never);
    await handler.handle(makeEnvelope([twoLinks[0]]) as never);
    expect(notify.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ invoiceId: 'inv-1', bookingId: 'bk-1' }),
      }),
    );
  });

  it('does not throw when paymentLinks is empty', async () => {
    const notify = { execute: jest.fn() };
    const pushTargets = { execute: jest.fn().mockResolvedValue({ pushEnabled: true, tokens: ['tok-1'] }) };
    const handler = new OnGroupSessionPaymentLinksReadyHandler(notify as never, pushTargets as never);
    await expect(handler.handle(makeEnvelope([]) as never)).resolves.toBeUndefined();
    expect(notify.execute).not.toHaveBeenCalled();
  });

  it('continues sending to remaining clients when one notification fails', async () => {
    const notify = {
      execute: jest.fn()
        .mockRejectedValueOnce(new Error('push failed'))
        .mockResolvedValueOnce(undefined),
    };
    const pushTargets = { execute: jest.fn().mockResolvedValue({ pushEnabled: true, tokens: ['tok-1'] }) };
    const handler = new OnGroupSessionPaymentLinksReadyHandler(notify as never, pushTargets as never);
    await expect(handler.handle(makeEnvelope(twoLinks) as never)).resolves.toBeUndefined();
    expect(notify.execute).toHaveBeenCalledTimes(2);
  });

  it('registers subscribe listener on register()', () => {
    const notify = { execute: jest.fn() };
    const eventBus = { subscribe: jest.fn() };
    const pushTargets = { execute: jest.fn().mockResolvedValue({ pushEnabled: true, tokens: ['tok-1'] }) };
    const handler = new OnGroupSessionPaymentLinksReadyHandler(notify as never, pushTargets as never);
    handler.register(eventBus as never);
    expect(eventBus.subscribe).toHaveBeenCalledWith(
      'group_session.payment_links_ready',
      expect.any(Function),
    );
  });
});
