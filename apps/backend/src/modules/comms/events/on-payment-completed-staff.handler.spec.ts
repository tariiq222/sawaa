import { PrismaService } from '../../../infrastructure/database';
import { Test, TestingModule } from '@nestjs/testing';
import { OnPaymentCompletedStaffHandler } from './on-payment-completed-staff.handler';
import { SendNotificationHandler } from '../send-notification/send-notification.handler';
import { GetStaffTargetsHandler } from '../notifications/get-staff-targets.handler';

describe('OnPaymentCompletedStaffHandler', () => {
  let handler: OnPaymentCompletedStaffHandler;
  let notify: SendNotificationHandler;
  const prisma = { booking: { findUnique: jest.fn().mockResolvedValue(null) } };

  beforeEach(async () => {
    prisma.booking.findUnique.mockResolvedValue(null);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OnPaymentCompletedStaffHandler,
        { provide: PrismaService, useValue: prisma },
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

  it('suppresses staff payment notices for late entries', async () => {
    prisma.booking.findUnique.mockResolvedValue({lateEntryRecordedAt: new Date()});
    await handler.handle({payload: {paymentId: 'p', invoiceId: 'i', bookingId: 'b', amount: 15000, currency: 'SAR', organizationId: 'o'}} as never);
    expect(notify.execute).not.toHaveBeenCalled();
  });

  it('should register event handler', () => {
    const eventBus = { subscribe: jest.fn() } as any;
    handler.register(eventBus);
    expect(eventBus.subscribe).toHaveBeenCalled();
  });

  it('should send notifications with the amount converted from halalas to SAR', async () => {
    await handler.handle({ payload: { paymentId: 'p1', invoiceId: 'i1', bookingId: 'b1', amount: 17500, currency: 'SAR', organizationId: 'org-1' } } as any);
    expect(notify.execute).toHaveBeenCalledWith(expect.objectContaining({
      body: 'تم استلام دفع بقيمة 175.00 SAR',
    }));
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
