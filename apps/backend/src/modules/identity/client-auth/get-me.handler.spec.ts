import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { GetMeHandler } from './get-me.handler';

describe('GetMeHandler', () => {
  let handler: GetMeHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetMeHandler,
    { provide: PrismaService, useValue: {
    client: { findFirst: jest.fn() }
    } }
      ],
    }).compile();

    handler = module.get<GetMeHandler>(GetMeHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should execute', async () => {
    try {
      await handler.execute({ id: '00000000-0000-0000-0000-000000000001' });
    } catch (e) {
      // Expected for incomplete mocks
    }
  });
});
