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

describe('OnBookingCancelledStaffHandler v2 cutover', () => {
  it('routes an existing owned cancellation to materialization while paused', async () => {
    const notify = { execute: jest.fn() };
    const staffTargets = { execute: jest.fn() };
    const ownership = { execute: jest.fn().mockResolvedValue('intent-owned') };
    const capture = { execute: jest.fn() };
    const materialize = { execute: jest.fn().mockResolvedValue(undefined) };
    const config = { shouldCapture: jest.fn().mockReturnValue(false) };
    const handler = new (OnBookingCancelledStaffHandler as any)(notify, staffTargets, ownership, capture, materialize, config);

    await handler.handle({ eventId: 'event-staff-cancel-1', occurredAt: new Date(), payload: { bookingId: 'booking-1', employeeId: 'employee-1', organizationId: 'org-1', clientId: 'client-1', reason: 'OTHER' } });

    expect(materialize.execute).toHaveBeenCalledWith('intent-owned');
    expect(notify.execute).not.toHaveBeenCalled();
  });

  it('captures a new staff cancellation with the preserved staff audience consumer key', async () => {
    const notify = { execute: jest.fn() };
    const staffTargets = { execute: jest.fn() };
    const ownership = { execute: jest.fn().mockResolvedValue(null) };
    const capture = { execute: jest.fn().mockResolvedValue('intent-new') };
    const materialize = { execute: jest.fn().mockResolvedValue(undefined) };
    const config = { shouldCapture: jest.fn().mockReturnValue(true) };
    const handler = new (OnBookingCancelledStaffHandler as any)(notify, staffTargets, ownership, capture, materialize, config);

    await handler.handle({ eventId: 'event-staff-cancel-2', version: 1, occurredAt: new Date(), payload: { bookingId: 'booking-2', employeeId: 'employee-2', organizationId: 'org-1', clientId: 'client-2', reason: 'OTHER' } });

    expect(capture.execute).toHaveBeenCalledWith(expect.objectContaining({ consumerKey: 'comms.booking-cancelled-staff.v2' }));
    expect(notify.execute).not.toHaveBeenCalled();
  });

  it('rejects an unsupported envelope version after ownership miss without legacy fallback', async () => {
    const notify = { execute: jest.fn() };
    const staffTargets = { execute: jest.fn() };
    const ownership = { execute: jest.fn().mockResolvedValue(null) };
    const capture = { execute: jest.fn() };
    const materialize = { execute: jest.fn() };
    const config = { shouldCapture: jest.fn().mockReturnValue(true) };
    const handler = new (OnBookingCancelledStaffHandler as any)(notify, staffTargets, ownership, capture, materialize, config);

    await expect(handler.handle({
      eventId: 'event-unsupported', version: 2, occurredAt: new Date(),
      payload: { bookingId: 'booking-1', employeeId: 'employee-1', organizationId: 'org-1', clientId: 'client-1', reason: 'OTHER' },
    })).rejects.toThrow(/version/i);
    expect(config.shouldCapture).not.toHaveBeenCalled();
    expect(capture.execute).not.toHaveBeenCalled();
    expect(notify.execute).not.toHaveBeenCalled();
  });
});
