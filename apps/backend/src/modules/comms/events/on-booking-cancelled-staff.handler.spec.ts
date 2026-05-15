import { Test, TestingModule } from '@nestjs/testing';
import { OnBookingCancelledStaffHandler } from './on-booking-cancelled-staff.handler';
import { SendNotificationHandler } from '../send-notification/send-notification.handler';
import { GetStaffTargetsHandler } from '../notifications/get-staff-targets.handler';
import { EventBusService } from '../../../infrastructure/events';

describe('OnBookingCancelledStaffHandler', () => {
  let handler: OnBookingCancelledStaffHandler;
  let notify: SendNotificationHandler;
  let staffTargets: GetStaffTargetsHandler;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OnBookingCancelledStaffHandler,
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

    handler = module.get<OnBookingCancelledStaffHandler>(OnBookingCancelledStaffHandler);
    notify = module.get<SendNotificationHandler>(SendNotificationHandler);
    staffTargets = module.get<GetStaffTargetsHandler>(GetStaffTargetsHandler);
  });

  it('should register event handler', () => {
    const eventBus = { subscribe: jest.fn() } as any;
    handler.register(eventBus);
    expect(eventBus.subscribe).toHaveBeenCalled();
  });

  it('should send notifications on booking cancelled', async () => {
    await handler.handle({ payload: { bookingId: 'b1', clientId: 'c1', employeeId: 'e1', organizationId: 'org-1', reason: 'test' } } as any);
    expect(notify.execute).toHaveBeenCalled();
  });

  it('should do nothing when no organizationId', async () => {
    await handler.handle({ payload: { bookingId: 'b1', clientId: 'c1', employeeId: 'e1', reason: 'test' } } as any);
    expect(staffTargets.execute).not.toHaveBeenCalled();
  });

  it('should handle errors gracefully', async () => {
    (staffTargets.execute as jest.Mock).mockRejectedValue(new Error('DB error'));
    await expect(handler.handle({ payload: { bookingId: 'b1', clientId: 'c1', employeeId: 'e1', organizationId: 'org-1', reason: 'test' } } as any)).resolves.not.toThrow();
  });
});
