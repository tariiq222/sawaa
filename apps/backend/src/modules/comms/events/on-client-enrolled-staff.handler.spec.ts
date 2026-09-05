import { Test, TestingModule } from '@nestjs/testing';
import { OnClientEnrolledStaffHandler } from './on-client-enrolled-staff.handler';
import { SendNotificationHandler } from '../send-notification/send-notification.handler';
import { GetStaffTargetsHandler } from '../notifications/get-staff-targets.handler';

describe('OnClientEnrolledStaffHandler', () => {
  let handler: OnClientEnrolledStaffHandler;
  let notify: SendNotificationHandler;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OnClientEnrolledStaffHandler,
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

    handler = module.get<OnClientEnrolledStaffHandler>(OnClientEnrolledStaffHandler);
    notify = module.get<SendNotificationHandler>(SendNotificationHandler);
  });

  it('should register event handler', () => {
    const eventBus = { subscribe: jest.fn() } as any;
    handler.register(eventBus);
    expect(eventBus.subscribe).toHaveBeenCalled();
  });

  it('should send notifications on client enrolled', async () => {
    await handler.handle({ payload: { clientId: 'c1', name: 'Test', organizationId: 'org-1' } } as any);
    expect(notify.execute).toHaveBeenCalled();
  });

  it('should do nothing when no organizationId', async () => {
    await handler.handle({ payload: { clientId: 'c1', name: 'Test' } } as any);
    expect(notify.execute).not.toHaveBeenCalled();
  });

  it('should handle errors gracefully', async () => {
    const staffTargets = (handler as any).staffTargets;
    staffTargets.execute = jest.fn().mockRejectedValue(new Error('DB error'));
    await expect(handler.handle({ payload: { clientId: 'c1', name: 'Test', organizationId: 'org-1' } } as any)).resolves.not.toThrow();
  });
});

describe('OnClientEnrolledStaffHandler v2 cutover', () => {
  it('routes an already-owned staff enrollment to materialization while paused', async () => {
    const notify = { execute: jest.fn() };
    const staffTargets = { execute: jest.fn() };
    const ownership = { execute: jest.fn().mockResolvedValue('intent-owned') };
    const capture = { execute: jest.fn() };
    const materialize = { execute: jest.fn().mockResolvedValue(undefined) };
    const config = { shouldCapture: jest.fn().mockReturnValue(false) };
    const handler = new (OnClientEnrolledStaffHandler as any)(notify, staffTargets, ownership, capture, materialize, config);

    await handler.handle({ eventId: 'event-staff-enrolled-1', occurredAt: new Date(), payload: { clientId: 'client-1', name: 'سارة', organizationId: 'org-1' } });

    expect(materialize.execute).toHaveBeenCalledWith('intent-owned');
    expect(notify.execute).not.toHaveBeenCalled();
  });

  it('captures a new staff enrollment with the stable client source key after cutover', async () => {
    const notify = { execute: jest.fn() };
    const staffTargets = { execute: jest.fn() };
    const ownership = { execute: jest.fn().mockResolvedValue(null) };
    const capture = { execute: jest.fn().mockResolvedValue('intent-new') };
    const materialize = { execute: jest.fn().mockResolvedValue(undefined) };
    const config = { shouldCapture: jest.fn().mockReturnValue(true) };
    const handler = new (OnClientEnrolledStaffHandler as any)(notify, staffTargets, ownership, capture, materialize, config);

    await handler.handle({ eventId: 'event-staff-enrolled-2', version: 1, occurredAt: new Date(), payload: { clientId: 'client-2', name: 'نورة', organizationId: 'org-1' } });

    expect(capture.execute).toHaveBeenCalledWith(expect.objectContaining({ sourceKey: 'client-enrolled:client-2', consumerKey: 'comms.client-enrolled-staff.v2' }));
    expect(notify.execute).not.toHaveBeenCalled();
  });

  it('rejects an unsupported envelope version after ownership miss without legacy fallback', async () => {
    const notify = { execute: jest.fn() };
    const staffTargets = { execute: jest.fn() };
    const ownership = { execute: jest.fn().mockResolvedValue(null) };
    const capture = { execute: jest.fn() };
    const materialize = { execute: jest.fn() };
    const config = { shouldCapture: jest.fn().mockReturnValue(true) };
    const handler = new (OnClientEnrolledStaffHandler as any)(notify, staffTargets, ownership, capture, materialize, config);

    await expect(handler.handle({
      eventId: 'event-unsupported', version: 2, occurredAt: new Date(),
      payload: { clientId: 'client-1', name: 'سارة', organizationId: 'org-1' },
    })).rejects.toThrow(/version/i);
    expect(config.shouldCapture).not.toHaveBeenCalled();
    expect(capture.execute).not.toHaveBeenCalled();
    expect(notify.execute).not.toHaveBeenCalled();
  });
});
