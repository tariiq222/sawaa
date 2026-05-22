import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { ListIntegrationsHandler } from './list-integrations.handler';

describe('ListIntegrationsHandler', () => {
  let handler: ListIntegrationsHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListIntegrationsHandler,
        { provide: PrismaService, useValue: {
    integration: { findMany: jest.fn() }
        } },
      ],
    }).compile();

    handler = module.get<ListIntegrationsHandler>(ListIntegrationsHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should execute successfully', async () => {
    (prisma.integration.findMany as jest.Mock).mockResolvedValue([
      { id: 'i1', provider: 'zoom', isActive: true, config: { ciphertext: 'x' }, createdAt: new Date(), updatedAt: new Date() },
    ]);
    const result = await handler.execute();
    expect(result).toEqual([
      expect.objectContaining({ id: 'i1', provider: 'zoom', isActive: true, hasConfig: true }),
    ]);
  });

  it('returns hasConfig=false when config is null (P0-11)', async () => {
    (prisma.integration.findMany as jest.Mock).mockResolvedValue([
      { id: 'i1', provider: 'zoom', isActive: true, config: null, createdAt: new Date(), updatedAt: new Date() },
    ]);
    const result = await handler.execute();
    expect(result[0]).not.toHaveProperty('config');
    expect(result[0]).toHaveProperty('hasConfig', false);
  });
});
