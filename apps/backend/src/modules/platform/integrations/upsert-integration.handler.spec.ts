import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { UpsertIntegrationHandler } from './upsert-integration.handler';

describe('UpsertIntegrationHandler', () => {
  let handler: UpsertIntegrationHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpsertIntegrationHandler,
        { provide: PrismaService, useValue: {
    integration: { upsert: jest.fn() }
        } },
      ],
    }).compile();

    handler = module.get<UpsertIntegrationHandler>(UpsertIntegrationHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should execute successfully', async () => {
    (prisma.integration.upsert as jest.Mock).mockResolvedValue({ id: 'test-id' });
    const result = await handler.execute({provider:"00000000-0000-0000-0000-000000000001",config:{key:"test"},isActive:true});
    expect(result).toBeDefined();
  });
});
