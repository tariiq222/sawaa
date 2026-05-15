import { Test, TestingModule } from '@nestjs/testing';
import { OnBookingCreatedStaffHandler } from './on-booking-created-staff.handler';
import { SendNotificationHandler } from '../send-notification/send-notification.handler';
import { GetStaffTargetsHandler } from '../notifications/get-staff-targets.handler';
import { EventBusService } from '../../../infrastructure/events';

describe('OnBookingCreatedStaffHandler', () => {
  let handler: OnBookingCreatedStaffHandler;
  let notify: SendNotificationHandler;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OnBookingCreatedStaffHandler,
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

    handler = module.get<OnBookingCreatedStaffHandler>(OnBookingCreatedStaffHandler);
    notify = module.get<SendNotificationHandler>(SendNotificationHandler);
  });

  it('should register event handler', () => {
    const eventBus = { subscribe: jest.fn() } as any;
    handler.register(eventBus);
    expect(eventBus.subscribe).toHaveBeenCalled();
  });

  it('should send notifications on booking created', async () => {
    await handler.handle({ payload: { bookingId: 'b1', clientId: 'c1', employeeId: 'e1', organizationId: 'org-1', scheduledAt: new Date(), serviceId: 's1' } } as any);
    expect(notify.execute).toHaveBeenCalled();
  });

  it('should handle errors gracefully', async () => {
    const staffTargets = (handler as any).staffTargets;
    staffTargets.execute = jest.fn().mockRejectedValue(new Error('DB error'));
    await expect(handler.handle({ payload: { bookingId: 'b1', clientId: 'c1', employeeId: 'e1', organizationId: 'org-1', scheduledAt: new Date(), serviceId: 's1' } } as any)).resolves.not.toThrow();
  });
});
