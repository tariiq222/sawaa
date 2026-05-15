import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { GetServiceHandler } from './get-service.handler';

describe('GetServiceHandler', () => {
  let handler: GetServiceHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetServiceHandler,
        { provide: PrismaService, useValue: {
    service: { findFirst: jest.fn() }
        } },
      ],
    }).compile();

    handler = module.get<GetServiceHandler>(GetServiceHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should execute successfully', async () => {
    (prisma.service.findFirst as jest.Mock).mockResolvedValue({ id: 'test-id' });
    const result = await handler.execute({serviceId:"00000000-0000-0000-0000-000000000001"});
    expect(result).toBeDefined();
    
    (prisma.service.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(handler.execute({serviceId:"00000000-0000-0000-0000-000000000001"})).rejects.toThrow();
  });
});
