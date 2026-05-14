import { OtpChannel } from '@prisma/client';

export interface NotificationChannel {
  readonly kind: OtpChannel;
  /**
   * @param identifier  email address or phone number
   * @param message     OTP code or message body
   * @param organizationId  optional — when provided, the channel attempts
   *                    to use the tenant's configured provider before
   *                    falling back to the platform-level transport.
   */
  send(identifier: string, message: string, organizationId?: string): Promise<void>;
}
