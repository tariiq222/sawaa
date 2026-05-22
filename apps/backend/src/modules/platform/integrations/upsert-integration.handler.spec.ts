import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { UpsertIntegrationHandler } from './upsert-integration.handler';
import { IntegrationCredentialsService } from '../../../infrastructure/integrations/integration-credentials.service';

describe('UpsertIntegrationHandler', () => {
  let handler: UpsertIntegrationHandler;
  let prisma: PrismaService;
  let creds: IntegrationCredentialsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpsertIntegrationHandler,
        { provide: PrismaService, useValue: { integration: { upsert: jest.fn() } } },
        {
          provide: IntegrationCredentialsService,
          useValue: { encrypt: jest.fn().mockReturnValue('CIPHERTEXT-BASE64') },
        },
      ],
    }).compile();

    handler = module.get(UpsertIntegrationHandler);
    prisma = module.get(PrismaService);
    creds = module.get(IntegrationCredentialsService);
  });

  it('encrypts the config blob and stores only ciphertext (P0-10)', async () => {
    (prisma.integration.upsert as jest.Mock).mockResolvedValue({ id: 'i1' });
    await handler.execute({
      provider: 'zoom',
      config: { apiKey: 'super-secret', webhookSecret: 'whk' },
      isActive: true,
    } as any);
    expect(creds.encrypt).toHaveBeenCalledWith({ apiKey: 'super-secret', webhookSecret: 'whk' });
    const call = (prisma.integration.upsert as jest.Mock).mock.calls[0][0];
    expect(call.create.config).toEqual({ ciphertext: 'CIPHERTEXT-BASE64' });
    expect(call.update.config).toEqual({ ciphertext: 'CIPHERTEXT-BASE64' });
    // Sanity: raw plaintext fields must not appear anywhere in the write.
    expect(JSON.stringify(call)).not.toContain('super-secret');
  });
});
