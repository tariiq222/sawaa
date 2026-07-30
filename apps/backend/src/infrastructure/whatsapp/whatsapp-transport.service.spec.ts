import { WhatsappTransportService } from './whatsapp-transport.service';

describe('WhatsappTransportService', () => {
  it('revalidates the stored URL immediately before exposing a credentialed client', async () => {
    const validator = { validate: jest.fn().mockResolvedValue({ origin: 'https://evolution.example.com' }) };
    const transport = new WhatsappTransportService(
      {
        whatsappAgentConfig: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'cfg-1',
            provider: 'EVOLUTION_API',
            evolutionBaseUrl: 'https://evolution.example.com',
            evolutionInstanceName: 'sawaa-main',
            credentialsCiphertext: 'ciphertext',
          }),
        },
      } as never,
      { decrypt: jest.fn().mockReturnValue({ evolutionApiKey: 'secret-key' }) } as never,
      validator as never,
    );

    await transport.resolve();

    expect(validator.validate).toHaveBeenCalledWith({
      newBaseUrl: 'https://evolution.example.com',
      previousBaseUrl: 'https://evolution.example.com',
    });
  });
});
