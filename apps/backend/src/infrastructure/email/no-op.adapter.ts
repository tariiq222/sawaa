// no-op adapter — returned when provider=NONE or credentials missing.
// Falls back silently (unlike SMS NoOp which throws) to preserve existing behavior
// where platform SMTP was the default.

import { Logger } from '@nestjs/common';
import type { EmailProvider, EmailSendPayload, EmailSendResult } from './email-provider.interface';

export class NoOpEmailAdapter implements EmailProvider {
  readonly name = 'NONE' as const;
  private readonly logger = new Logger(NoOpEmailAdapter.name);

  isAvailable(): boolean {
    return false;
  }

  async sendMail(payload: EmailSendPayload): Promise<EmailSendResult> {
    this.logger.warn(
      `Email provider not configured — skipping send to ${payload.to}`,
    );
    return { messageId: 'noop' };
  }
}
