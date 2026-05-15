import { Test, TestingModule } from '@nestjs/testing';
import { OnPaymentCompletedStaffHandler } from './on-payment-completed-staff.handler';
import { SendNotificationHandler } from '../send-notification/send-notification.handler';
import { GetStaffTargetsHandler } from '../notifications/get-staff-targets.handler';

describe('OnPaymentCompletedStaffHandler', () => {
  let handler: OnPaymentCompletedStaffHandler;
  let notify: SendNotificationHandler;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OnPaymentCompletedStaffHandler,
        {
          provide: SendNotificationHandler,
          useValue: { execute: jest.fn() },
        },
        {
          provide: GetStaffTargetsHandler,
          useValue: { execute: jest.fn().mockResolvedValue([{ userId: 'u1' }]) },
        },
      ],
    }).compile();

    handler = module.get<OnPaymentCompletedStaffHandler>(OnPaymentCompletedStaffHandler);
    notify = module.get<SendNotificationHandler>(SendNotificationHandler);
  });

  it('should register event handler', () => {
    const eventBus = { subscribe: jest.fn() } as any;
    handler.register(eventBus);
    expect(eventBus.subscribe).toHaveBeenCalled();
  });

  it('should send notifications on payment completed', async () => {
    await handler.handle({ payload: { paymentId: 'p1', invoiceId: 'i1', bookingId: 'b1', amount: 100, currency: 'SAR', organizationId: 'org-1' } } as any);
    expect(notify.execute).toHaveBeenCalled();
  });

  it('should do nothing when no organizationId', async () => {
    await handler.handle({ payload: { paymentId: 'p1', invoiceId: 'i1', bookingId: 'b1', amount: 100, currency: 'SAR' } } as any);
    expect(notify.execute).not.toHaveBeenCalled();
  });

  it('should handle errors gracefully', async () => {
    const staffTargets = (handler as any).staffTargets;
    staffTargets.execute = jest.fn().mockRejectedValue(new Error('DB error'));
    await expect(handler.handle({ payload: { paymentId: 'p1', invoiceId: 'i1', bookingId: 'b1', amount: 100, currency: 'SAR', organizationId: 'org-1' } } as any)).resolves.not.toThrow();
  });
});
