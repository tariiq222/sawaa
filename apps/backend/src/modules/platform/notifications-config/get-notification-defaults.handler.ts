import { Injectable } from '@nestjs/common';
import { PlatformSettingsService } from '../settings/platform-settings.service';
import { NotificationChannel } from './update-notification-defaults.dto';

@Injectable()
export class GetNotificationDefaultsHandler {
  constructor(private readonly settings: PlatformSettingsService) {}

  async execute() {
    const [channels, quietHours, serverKey, projectId, clientEmail] = await Promise.all([
      this.settings.get<NotificationChannel[]>('notifications.defaultChannels'),
      this.settings.get<{ startHour: number; endHour: number; timezone: string }>('notifications.quietHours'),
      this.settings.get<string>('notifications.fcm.serverKey', 'FCM_PRIVATE_KEY'),
      this.settings.get<string>('notifications.fcm.projectId', 'FCM_PROJECT_ID'),
      this.settings.get<string>('notifications.fcm.clientEmail', 'FCM_CLIENT_EMAIL'),
    ]);

    return {
      defaultChannels: channels ?? ['EMAIL', 'IN_APP'],
      quietHours: quietHours ?? { startHour: 22, endHour: 8, timezone: 'Asia/Riyadh' },
      fcm: {
        serverKey: serverKey ? '***' : '',
        projectId: projectId ?? '',
        clientEmail: clientEmail ?? '',
      },
    };
  }
}
