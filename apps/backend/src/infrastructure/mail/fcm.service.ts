import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { PlatformSettingsService } from '../../modules/platform/settings/platform-settings.service';

export interface IFcmService {
  sendPush(token: string, title: string, body: string, data?: Record<string, string>): Promise<string>;
  sendMulticast(tokens: string[], title: string, body: string, data?: Record<string, string>): Promise<{ successCount: number; failureCount: number }>;
  isAvailable(): boolean;
}

@Injectable()
export class FcmService implements IFcmService, OnModuleInit {
  private readonly logger = new Logger(FcmService.name);
  private initialized = false;

  constructor(
    private readonly config: ConfigService,
    @Optional() private readonly platformSettings?: PlatformSettingsService,
  ) {}

  async onModuleInit(): Promise<void> {
    let projectId: string | undefined;
    let clientEmail: string | undefined;
    let privateKey: string | undefined;

    // Try DB first via PlatformSettingsService
    if (this.platformSettings) {
      try {
        const [dbProjectId, dbClientEmail, dbServerKey] = await Promise.all([
          this.platformSettings.get<string>('notifications.fcm.projectId'),
          this.platformSettings.get<string>('notifications.fcm.clientEmail'),
          this.platformSettings.get<string>('notifications.fcm.serverKey'),
        ]);
        if (dbProjectId) projectId = dbProjectId;
        if (dbClientEmail) clientEmail = dbClientEmail;
        if (dbServerKey) privateKey = dbServerKey.replace(/\\n/g, '\n');
      } catch (err) {
        this.logger.warn('Could not read FCM credentials from DB, falling back to env vars', err);
      }
    }

    // Fall back to env vars for any missing values
    if (!projectId) projectId = this.config.get<string>('FCM_PROJECT_ID');
    if (!clientEmail) clientEmail = this.config.get<string>('FCM_CLIENT_EMAIL');
    if (!privateKey) {
      const envKey = this.config.get<string>('FCM_PRIVATE_KEY');
      if (envKey) privateKey = envKey.replace(/\\n/g, '\n');
    }

    if (!projectId) {
      this.logger.warn('FCM_PROJECT_ID not set — push notifications disabled');
      return;
    }

    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });

    this.initialized = true;
    this.logger.log('Firebase Admin initialized');
  }

  isAvailable(): boolean {
    return this.initialized;
  }

  async sendPush(
    token: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<string> {
    if (!this.initialized) {
      throw new Error('FCM is not initialized');
    }

    const messageId = await admin.messaging().send({
      token,
      notification: { title, body },
      data,
    });

    return messageId;
  }

  async sendMulticast(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<{ successCount: number; failureCount: number }> {
    if (!this.initialized) {
      throw new Error('FCM is not initialized');
    }

    const response = await admin.messaging().sendEachForMulticast({
      tokens,
      notification: { title, body },
      data,
    });

    return {
      successCount: response.successCount,
      failureCount: response.failureCount,
    };
  }
}
