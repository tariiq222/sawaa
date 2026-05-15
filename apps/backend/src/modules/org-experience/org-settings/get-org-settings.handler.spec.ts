import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { GetOrgSettingsHandler } from './get-org-settings.handler';

describe('GetOrgSettingsHandler', () => {
  let handler: GetOrgSettingsHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetOrgSettingsHandler,
        { provide: PrismaService, useValue: {
    organizationSettings: { findFirst: jest.fn() }
        } },
      ],
    }).compile();

    handler = module.get<GetOrgSettingsHandler>(GetOrgSettingsHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should execute successfully', async () => {
    (prisma.organizationSettings.findFirst as jest.Mock).mockResolvedValue({ id: 'test-id' });
    const result = await handler.execute();
    expect(result).toBeDefined();
  });
});
