import { WhatsappEvolutionConfigService } from './whatsapp-evolution-config.service';

describe('WhatsappEvolutionConfigService', () => {
  it('returns the backend-owned Evolution settings without exposing them to callers', () => {
    const service = new WhatsappEvolutionConfigService({
      get: (key: string) =>
        ({
          WHATSAPP_EVOLUTION_BASE_URL: 'http://localhost:8090/',
          WHATSAPP_EVOLUTION_INSTANCE_NAME: 'sawaa-main',
          WHATSAPP_EVOLUTION_API_KEY: 'backend-key',
          WHATSAPP_EVOLUTION_WEBHOOK_SECRET: 'backend-webhook-secret',
        })[key],
    } as never);

    expect(service.get()).toEqual({
      baseUrl: 'http://localhost:8090',
      instanceName: 'sawaa-main',
      apiKey: 'backend-key',
      webhookSecret: 'backend-webhook-secret',
    });
  });

  it('returns null when the backend API key is missing', () => {
    const service = new WhatsappEvolutionConfigService({
      get: (key: string) =>
        ({
          WHATSAPP_EVOLUTION_BASE_URL: 'http://localhost:8090',
          WHATSAPP_EVOLUTION_INSTANCE_NAME: 'sawaa-main',
        })[key],
    } as never);

    expect(service.get()).toBeNull();
  });
});
