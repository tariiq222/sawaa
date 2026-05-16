import { Test } from '@nestjs/testing';
import { PlatformSettingsService } from '../settings/platform-settings.service';
import { GetNotificationDefaultsHandler } from './get-notification-defaults.handler';

describe('GetNotificationDefaultsHandler', () => {
  let handler: GetNotificationDefaultsHandler;
  let settings: any;

  beforeEach(async () => {
    settings = { get: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        GetNotificationDefaultsHandler,
        { provide: PlatformSettingsService, useValue: settings },
      ],
    }).compile();

    handler = module.get(GetNotificationDefaultsHandler);
  });

  it('should be defined', () => expect(handler).toBeDefined());

  it('should return defaults when settings are null', async () => {
    settings.get.mockResolvedValue(null);
    const result = await handler.execute();
    expect(result.defaultChannels).toEqual(['EMAIL', 'IN_APP']);
    expect(result.quietHours).toEqual({ startHour: 22, endHour: 8, timezone: 'Asia/Riyadh' });
    expect(result.fcm.serverKey).toBe('');
    expect(result.fcm.projectId).toBe('');
    expect(result.fcm.clientEmail).toBe('');
  });

  it('should return masked serverKey when present', async () => {
    settings.get.mockImplementation((key: string, def?: unknown) => {
      if (key === 'notifications.fcm.serverKey') return 'secret-key';
      if (key === 'notifications.fcm.projectId') return 'my-project';
      if (key === 'notifications.fcm.clientEmail') return 'svc@example.com';
      return null;
    });
    const result = await handler.execute();
    expect(result.fcm.serverKey).toBe('***');
    expect(result.fcm.projectId).toBe('my-project');
    expect(result.fcm.clientEmail).toBe('svc@example.com');
  });

  it('should return stored custom values', async () => {
    settings.get.mockImplementation((key: string) => {
      if (key === 'notifications.defaultChannels') return ['SMS'];
      if (key === 'notifications.quietHours') return { startHour: 1, endHour: 5, timezone: 'UTC' };
      return null;
    });
    const result = await handler.execute();
    expect(result.defaultChannels).toEqual(['SMS']);
    expect(result.quietHours).toEqual({ startHour: 1, endHour: 5, timezone: 'UTC' });
  });
});
