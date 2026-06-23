import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { GetZoomConfigHandler } from './get-zoom-config.handler';

describe('GetZoomConfigHandler', () => {
  let handler: GetZoomConfigHandler;
  let prisma: { integration: { findFirst: jest.Mock } };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetZoomConfigHandler,
        {
          provide: PrismaService,
          useValue: { integration: { findFirst: jest.fn() } },
        },
      ],
    }).compile();

    handler = module.get<GetZoomConfigHandler>(GetZoomConfigHandler);
    prisma = module.get(PrismaService) as typeof prisma;
  });

  it('returns { configured: true, isActive } when the zoom integration row exists', async () => {
    prisma.integration.findFirst.mockResolvedValue({ id: 'zoom-1', isActive: true });

    const result = await handler.execute();

    expect(result).toEqual({ configured: true, isActive: true });
    expect(prisma.integration.findFirst).toHaveBeenCalledWith({
      where: { provider: 'zoom' },
    });
  });

  it('reflects isActive=false in the response when the row exists but is disabled', async () => {
    prisma.integration.findFirst.mockResolvedValue({ id: 'zoom-1', isActive: false });

    const result = await handler.execute();

    expect(result).toEqual({ configured: true, isActive: false });
  });

  it('returns { configured: false, isActive: false } when NO zoom row exists (no-credentials path)', async () => {
    prisma.integration.findFirst.mockResolvedValue(null);

    const result = await handler.execute();

    expect(result).toEqual({ configured: false, isActive: false });
    expect(prisma.integration.findFirst).toHaveBeenCalledTimes(1);
  });
});
