import { ConfigService } from '@nestjs/config';
import { WhatsappCredentialsService } from './whatsapp-credentials.service';

describe('WhatsappCredentialsService', () => {
  it('can be constructed while the optional WhatsApp integration is not configured', () => {
    expect(
      () =>
        new WhatsappCredentialsService({
          get: () => undefined,
        } as unknown as ConfigService),
    ).not.toThrow();
  });

  it('refuses to encrypt credentials until the WhatsApp key is configured', () => {
    const service = new WhatsappCredentialsService({
      get: () => undefined,
    } as unknown as ConfigService);

    expect(() => service.encrypt({ aiApiKey: 'secret' }, 'sawaa')).toThrow(
      'WHATSAPP_PROVIDER_ENCRYPTION_KEY missing',
    );
  });
});
