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
