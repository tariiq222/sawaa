import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PlatformSettingsService } from '../settings/platform-settings.service';
import { UpdateNotificationDefaultsHandler } from './update-notification-defaults.handler';

describe('UpdateNotificationDefaultsHandler', () => {
  let handler: UpdateNotificationDefaultsHandler;
  let settings: any;

  beforeEach(async () => {
    settings = { get: jest.fn(), set: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        UpdateNotificationDefaultsHandler,
        { provide: PlatformSettingsService, useValue: settings },
      ],
    }).compile();

    handler = module.get(UpdateNotificationDefaultsHandler);
  });

  it('should be defined', () => expect(handler).toBeDefined());

  it('should skip updates when values are equal', async () => {
    settings.get.mockResolvedValue('old');
    await handler.execute({ dto: { defaultChannels: 'old' as any }, superAdminUserId: 'u1', ipAddress: '', userAgent: '' });
    expect(settings.set).not.toHaveBeenCalled();
  });

  it('should update defaultChannels when changed', async () => {
    settings.get.mockResolvedValue(['EMAIL']);
    await handler.execute({ dto: { defaultChannels: ['EMAIL', 'SMS'] as any }, superAdminUserId: 'u1', ipAddress: '', userAgent: '' });
    expect(settings.set).toHaveBeenCalledWith('notifications.defaultChannels', ['EMAIL', 'SMS'], 'u1', false);
  });

  it('should throw for invalid timezone', async () => {
    await expect(handler.execute({
      dto: { quietHours: { startHour: 22, endHour: 8, timezone: 'Invalid/Zone' } },
      superAdminUserId: 'u1', ipAddress: '', userAgent: '',
    })).rejects.toThrow(BadRequestException);
  });

  it('should update quietHours when timezone is valid', async () => {
    settings.get.mockResolvedValue({ startHour: 0, endHour: 0, timezone: 'UTC' });
    const qh = { startHour: 22, endHour: 8, timezone: 'Asia/Riyadh' };
    await handler.execute({ dto: { quietHours: qh }, superAdminUserId: 'u1', ipAddress: '', userAgent: '' });
    expect(settings.set).toHaveBeenCalledWith('notifications.quietHours', qh, 'u1', false);
  });

  it('should update fcm fields', async () => {
    settings.get.mockImplementation((key) => {
      if (key === 'notifications.fcm.serverKey') return 'old-key';
      if (key === 'notifications.fcm.projectId') return 'old-pid';
      if (key === 'notifications.fcm.clientEmail') return 'old-email';
      return null;
    });
    await handler.execute({
      dto: { fcm: { serverKey: 'new-key', projectId: 'new-pid', clientEmail: 'new-email' } },
      superAdminUserId: 'u1', ipAddress: '', userAgent: '',
    });
    expect(settings.set).toHaveBeenCalledWith('notifications.fcm.serverKey', 'new-key', 'u1', true);
    expect(settings.set).toHaveBeenCalledWith('notifications.fcm.projectId', 'new-pid', 'u1', false);
    expect(settings.set).toHaveBeenCalledWith('notifications.fcm.clientEmail', 'new-email', 'u1', true);
  });

  it('should handle deeply equal objects as unchanged', async () => {
    settings.get.mockResolvedValue({ a: [1, 2] });
    await handler.execute({ dto: { defaultChannels: { a: [1, 2] } as any }, superAdminUserId: 'u1', ipAddress: '', userAgent: '' });
    expect(settings.set).not.toHaveBeenCalled();
  });

  it('should handle JSON stringify error as not equal', async () => {
    const circular: any = { a: 1 };
    circular.self = circular;
    settings.get.mockResolvedValue(circular);
    await handler.execute({ dto: { defaultChannels: { a: 1 } as any }, superAdminUserId: 'u1', ipAddress: '', userAgent: '' });
    expect(settings.set).toHaveBeenCalled();
  });
});
