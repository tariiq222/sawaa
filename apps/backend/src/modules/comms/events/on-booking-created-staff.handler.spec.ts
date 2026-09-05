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

describe('OnBookingCreatedStaffHandler v2 cutover', () => {
  it('materializes an already-owned event even when capture is later paused', async () => {
    const notify = { execute: jest.fn() };
    const staffTargets = { execute: jest.fn() };
    const ownership = { execute: jest.fn().mockResolvedValue('intent-owned') };
    const capture = { execute: jest.fn() };
    const materialize = { execute: jest.fn().mockResolvedValue(undefined) };
    const config = { shouldCapture: jest.fn().mockReturnValue(false) };
    const handler = new (OnBookingCreatedStaffHandler as any)(notify, staffTargets, ownership, capture, materialize, config);

    await handler.handle({
      eventId: 'event-1',
      occurredAt: new Date('2026-09-05T12:00:00Z'),
      payload: { bookingId: 'booking-1', employeeId: 'employee-1', organizationId: 'org-1', clientId: 'client-1', serviceId: 'service-1', scheduledAt: new Date() },
    });

    expect(materialize.execute).toHaveBeenCalledWith('intent-owned');
    expect(capture.execute).not.toHaveBeenCalled();
    expect(notify.execute).not.toHaveBeenCalled();
  });

  it('captures and materializes an eligible new event and propagates v2 failures', async () => {
    const notify = { execute: jest.fn() };
    const staffTargets = { execute: jest.fn() };
    const ownership = { execute: jest.fn().mockResolvedValue(null) };
    const capture = { execute: jest.fn().mockResolvedValue('intent-new') };
    const materialize = { execute: jest.fn().mockRejectedValue(new Error('materialize failed')) };
    const config = { shouldCapture: jest.fn().mockReturnValue(true) };
    const handler = new (OnBookingCreatedStaffHandler as any)(notify, staffTargets, ownership, capture, materialize, config);

    await expect(handler.handle({
      eventId: 'event-2', version: 1,
      occurredAt: new Date('2026-09-05T12:00:00Z'),
      payload: { bookingId: 'booking-2', employeeId: 'employee-2', organizationId: 'org-1', clientId: 'client-2', serviceId: 'service-1', scheduledAt: new Date() },
    })).rejects.toThrow('materialize failed');
    expect(capture.execute).toHaveBeenCalledWith(expect.objectContaining({ sourceKey: 'domain-event:event-2', consumerKey: 'comms.booking-created-staff.v2' }));
    expect(notify.execute).not.toHaveBeenCalled();
  });

  it('rejects an unsupported envelope version after ownership miss without legacy fallback', async () => {
    const notify = { execute: jest.fn() };
    const staffTargets = { execute: jest.fn() };
    const ownership = { execute: jest.fn().mockResolvedValue(null) };
    const capture = { execute: jest.fn() };
    const materialize = { execute: jest.fn() };
    const config = { shouldCapture: jest.fn().mockReturnValue(true) };
    const handler = new (OnBookingCreatedStaffHandler as any)(notify, staffTargets, ownership, capture, materialize, config);

    await expect(handler.handle({
      eventId: 'event-unsupported', version: 2, occurredAt: new Date(),
      payload: { bookingId: 'booking-1', employeeId: 'employee-1', organizationId: 'org-1', clientId: 'client-1', serviceId: 'service-1', scheduledAt: new Date() },
    })).rejects.toThrow(/version/i);
    expect(config.shouldCapture).not.toHaveBeenCalled();
    expect(capture.execute).not.toHaveBeenCalled();
    expect(notify.execute).not.toHaveBeenCalled();
  });
});
