import { Test } from '@nestjs/testing';
import { EventBusService } from '../../../infrastructure/events';
import { SendNotificationHandler } from '../send-notification/send-notification.handler';
import { GetClientPushTargetsHandler } from '../fcm-tokens/get-client-push-targets.handler';
import { OnPaymentFailedHandler } from './on-payment-failed.handler';

describe('OnPaymentFailedHandler', () => {
  let handler: OnPaymentFailedHandler;
  let notify: any;
  let pushTargets: any;
  let eventBus: any;

  beforeEach(async () => {
    notify = { execute: jest.fn() };
    pushTargets = { execute: jest.fn() };
    eventBus = { subscribe: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        OnPaymentFailedHandler,
        { provide: SendNotificationHandler, useValue: notify },
        { provide: GetClientPushTargetsHandler, useValue: pushTargets },
      ],
    }).compile();

    handler = module.get(OnPaymentFailedHandler);
  });

  it('should be defined', () => expect(handler).toBeDefined());

  it('should subscribe on register', () => {
    handler.register(eventBus as any);
    expect(eventBus.subscribe).toHaveBeenCalledWith('finance.payment.failed', expect.any(Function));
  });

  it('should send notification without push when disabled', async () => {
    pushTargets.execute.mockResolvedValue({ pushEnabled: false, tokens: [] });
    await handler.handle({ payload: { paymentId: 'p1', clientId: 'c1', amount: 100, currency: 'SAR', clientEmail: 'a@b.com', clientName: 'John' } } as any);
    expect(notify.execute).toHaveBeenCalledWith(expect.objectContaining({
      channels: ['in-app', 'email'],
      type: 'PAYMENT_FAILED',
      body: expect.stringContaining('100 SAR'),
    }));
  });

  it('should add push channel when enabled with tokens', async () => {
    pushTargets.execute.mockResolvedValue({ pushEnabled: true, tokens: ['tok1'] });
    await handler.handle({ payload: { paymentId: 'p1', clientId: 'c1', amount: 50, currency: 'USD' } } as any);
    expect(notify.execute).toHaveBeenCalledWith(expect.objectContaining({ channels: ['in-app', 'email', 'push'] }));
  });

  it('should swallow notification errors', async () => {
    pushTargets.execute.mockRejectedValue(new Error('fail'));
    await expect(handler.handle({ payload: { paymentId: 'p1', clientId: 'c1', amount: 100, currency: 'SAR' } } as any)).resolves.not.toThrow();
  });
});
