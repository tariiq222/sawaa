import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { GetServiceBookingConfigsHandler } from './get-service-booking-configs.handler';

describe('GetServiceBookingConfigsHandler', () => {
  let handler: GetServiceBookingConfigsHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetServiceBookingConfigsHandler,
        { provide: PrismaService, useValue: {
    service: { findFirst: jest.fn() },
    serviceBookingConfig: { findMany: jest.fn() }
        } },
      ],
    }).compile();

    handler = module.get<GetServiceBookingConfigsHandler>(GetServiceBookingConfigsHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should execute', async () => {
    (prisma.service.findFirst as jest.Mock).mockResolvedValue({ id: 'test' });
    await handler.execute({serviceId:"00000000-0000-0000-0000-000000000001"});
    
    (prisma.service.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(handler.execute({serviceId:"00000000-0000-0000-0000-000000000001"})).rejects.toThrow();
  });
});
