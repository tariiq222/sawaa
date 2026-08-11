import { BadRequestException } from '@nestjs/common';
import { UpsertWhatsappConfigHandler } from './upsert-whatsapp-config.handler';

describe('UpsertWhatsappConfigHandler', () => {
  const runtime = {
    baseUrl: 'https://evolution.example.com',
    instanceName: 'sawaa-main',
    apiKey: 'backend-key',
    webhookSecret: 'backend-webhook-secret',
  };

  function buildHandler(existing: Record<string, unknown> | null = null) {
    const prisma = {
      whatsappAgentConfig: {
        findFirst: jest.fn().mockResolvedValue(existing),
        create: jest.fn().mockImplementation(async ({ data }) => ({ id: 'cfg-1', ...data })),
        update: jest.fn().mockImplementation(async ({ data }) => ({ id: 'cfg-1', ...data })),
      },
    };
    const evolutionConfig = { get: jest.fn().mockReturnValue(runtime) };
    const config = {
      get: jest.fn((key: string) =>
        key === 'API_PUBLIC_URL' ? 'https://api.sawaa.app' : undefined,
      ),
    };
    const handler = new UpsertWhatsappConfigHandler(
      prisma as never,
      evolutionConfig as never,
      config as never,
    );
    return { handler, prisma, evolutionConfig };
  }

  it('rejects providers that are not configured by the backend', async () => {
    const { handler } = buildHandler();

    await expect(handler.execute({ provider: 'META_CLOUD' })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects saving when backend Evolution settings are missing', async () => {
    const { handler, evolutionConfig } = buildHandler();
    evolutionConfig.get.mockReturnValue(null);

    await expect(
      handler.execute({ provider: 'EVOLUTION_API', isActive: true }),
    ).rejects.toThrow(/not configured on the backend/);
  });

  it('uses backend-owned settings and never accepts dashboard credentials', async () => {
    const { handler, prisma } = buildHandler();

    await handler.execute({ provider: 'EVOLUTION_API', isActive: false });

    expect(prisma.whatsappAgentConfig.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        provider: 'EVOLUTION_API',
        evolutionBaseUrl: runtime.baseUrl,
        evolutionInstanceName: runtime.instanceName,
        isActive: false,
      }),
    });
  });

  it('registers the backend webhook secret after successful verification', async () => {
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ instance: { state: 'open' } }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const { handler } = buildHandler();

    const result = await handler.execute({ provider: 'EVOLUTION_API', isActive: true });

    expect(result.verified).toBe(true);
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      'https://evolution.example.com/webhook/set/sawaa-main',
      expect.objectContaining({
        body: expect.stringContaining('backend-webhook-secret'),
      }),
    );
  });
});
