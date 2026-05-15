import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { GetZoomConfigHandler } from './get-zoom-config.handler';

describe('GetZoomConfigHandler', () => {
  let handler: GetZoomConfigHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetZoomConfigHandler,
        { provide: PrismaService, useValue: {
    integration: { findFirst: jest.fn() }
        } },
      ],
    }).compile();

    handler = module.get<GetZoomConfigHandler>(GetZoomConfigHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should execute successfully', async () => {
    (prisma.integration.findFirst as jest.Mock).mockResolvedValue({ id: 'test-id' });
    const result = await handler.execute();
    expect(result).toBeDefined();
  });
});
