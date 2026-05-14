import { Injectable, Logger } from '@nestjs/common';
import { FcmService } from '../../../infrastructure/mail';
import { SendPushDto } from './send-push.dto';

@Injectable()
export class SendPushHandler {
  private readonly logger = new Logger(SendPushHandler.name);

  constructor(private readonly fcm: FcmService) {}

  async execute(dto: SendPushDto): Promise<void> {
    if (!this.fcm.isAvailable()) {
      this.logger.warn('FCM not available — skipping push notification');
      return;
    }
    try {
      await this.fcm.sendPush(dto.token, dto.title, dto.body, dto.data);
    } catch (err) {
      this.logger.error(`Failed to send push to token ${dto.token}`, err);
    }
  }
}
