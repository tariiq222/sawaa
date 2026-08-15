import { ConfigService } from '@nestjs/config';
import { AiProviderClientService } from '../../../infrastructure/ai/ai-provider-client.service';
import { WebChatAvailabilityService } from './web-chat-availability.service';

describe('WebChatAvailabilityService', () => {
  it('keeps the public widget enabled while processing is unavailable until a tested provider is ready', async () => {
    const providerClient = { getReadyClient: jest.fn().mockResolvedValue(null) };
    const service = new WebChatAvailabilityService(
      { get: (key: string) => key === 'WEB_CHAT_ENABLED' ? true : undefined } as unknown as ConfigService,
      providerClient as unknown as AiProviderClientService,
    );

    expect(service.isEnabled()).toBe(true);
    await expect(service.isProcessingReady()).resolves.toBe(false);
    expect(providerClient.getReadyClient).toHaveBeenCalledTimes(1);
  });

  it('reports ready only for a connected, tested provider client', async () => {
    const providerClient = { getReadyClient: jest.fn().mockResolvedValue({ client: {}, model: 'model', provider: 'OPENAI', configVersion: 4, testedConfigHash: 'hash-4' }) };
    const service = new WebChatAvailabilityService(
      { get: (key: string) => key === 'WEB_CHAT_ENABLED' ? true : undefined } as unknown as ConfigService,
      providerClient as unknown as AiProviderClientService,
    );

    await expect(service.isProcessingReady()).resolves.toBe(true);
    await expect(service.isProcessingReady({ configVersion: 3, testedConfigHash: 'hash-3' })).resolves.toBe(false);
    await expect(service.isProcessingReady({ configVersion: 4, testedConfigHash: 'hash-4' })).resolves.toBe(true);
  });

  it('does not consult provider readiness when the public widget is disabled', async () => {
    const providerClient = { getReadyClient: jest.fn() };
    const service = new WebChatAvailabilityService(
      { get: (key: string) => key === 'WEB_CHAT_ENABLED' ? false : undefined } as unknown as ConfigService,
      providerClient as unknown as AiProviderClientService,
    );

    await expect(service.isProcessingReady()).resolves.toBe(false);
    expect(providerClient.getReadyClient).not.toHaveBeenCalled();
  });
});
