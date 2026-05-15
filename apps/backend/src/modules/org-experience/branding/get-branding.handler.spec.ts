import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { GetBrandingHandler } from './get-branding.handler';

describe('GetBrandingHandler', () => {
  let handler: GetBrandingHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetBrandingHandler,
        { provide: PrismaService, useValue: {
    brandingConfig: { findFirst: jest.fn(), create: jest.fn() }
        } },
      ],
    }).compile();

    handler = module.get<GetBrandingHandler>(GetBrandingHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should execute successfully', async () => {
    (prisma.brandingConfig.findFirst as jest.Mock).mockResolvedValue({ id: 'test-id' });
    const result = await handler.execute();
    expect(result).toBeDefined();
  });
});
