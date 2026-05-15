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
    (prisma.integration.findMany as jest.Mock).mockResolvedValue({ id: 'test-id' });
    const result = await handler.execute();
    expect(result).toBeDefined();
  });
});
