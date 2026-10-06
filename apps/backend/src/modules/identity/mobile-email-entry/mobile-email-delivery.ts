import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { EmailProviderRejectedError } from '../../../infrastructure/email/email-provider.interface';
import { AuthenticaClient } from '../../../infrastructure/authentica';
import { AuthenticaError } from '../../../infrastructure/authentica/authentica.client';
import { EmailChannelNotConfiguredError } from '../../comms/notification-channel/email-channel.adapter';
import { NotificationChannelRegistry } from '../../comms/notification-channel/notification-channel-registry';

export class EmailEntryDeliveryError extends ServiceUnavailableException {
  constructor(readonly outcome: 'rejected' | 'unknown') { super({ code: 'delivery_unavailable' }); }
}
@Injectable()
export class MobileEmailDelivery {
  constructor(private readonly registry: NotificationChannelRegistry, private readonly authentica: AuthenticaClient) {}
  async send(channel: 'EMAIL' | 'SMS', identifier: string, code: string): Promise<void> {
    if (channel === 'SMS' && !this.authentica.isConfigured()) throw new EmailEntryDeliveryError('rejected');
    try { await this.registry.resolve(channel).send(identifier, code); }
    catch (error) {
      // Only a typed explicit provider rejection is certain. Unknown/network
      // failures may have delivered and must keep the hourly reservation.
      const rejected = error instanceof EmailProviderRejectedError || error instanceof EmailChannelNotConfiguredError || error instanceof AuthenticaError && error.status >= 400 && error.status < 500 && error.status !== 408;
      throw new EmailEntryDeliveryError(rejected ? 'rejected' : 'unknown');
    }
  }
}
