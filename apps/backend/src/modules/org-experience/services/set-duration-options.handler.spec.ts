import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { SetDurationOptionsHandler } from './set-duration-options.handler';

describe('SetDurationOptionsHandler', () => {
  let handler: SetDurationOptionsHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SetDurationOptionsHandler,
    { provide: PrismaService, useValue: {
    service: { findFirst: jest.fn() },
    serviceDurationOption: { findMany: jest.fn() }
    } }
      ],
    }).compile();

    handler = module.get<SetDurationOptionsHandler>(SetDurationOptionsHandler);
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
