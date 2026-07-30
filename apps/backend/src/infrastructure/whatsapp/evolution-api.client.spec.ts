import { EvolutionApiClient } from './evolution-api.client';

describe('EvolutionApiClient', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('registers the Evolution v2 webhook envelope with jwt_key', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    const client = new EvolutionApiClient({
      baseUrl: 'https://evolution.example.com',
      apiKey: 'api-key',
      instanceName: 'sawaa-main',
    });

    await client.setWebhook(
      'https://api.sawaa.app/api/v1/public/whatsapp/webhook',
      'jwt-secret',
    );

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://evolution.example.com/webhook/set/sawaa-main',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          webhook: {
            enabled: true,
            url: 'https://api.sawaa.app/api/v1/public/whatsapp/webhook',
            headers: { jwt_key: 'jwt-secret' },
            byEvents: false,
            base64: false,
            events: ['MESSAGES_UPSERT'],
          },
        }),
      }),
    );
  });
});
