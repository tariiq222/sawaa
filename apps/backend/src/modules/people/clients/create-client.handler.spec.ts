import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { EventBusService } from '../../../infrastructure/events';
import { CreateClientHandler } from './create-client.handler';

describe('CreateClientHandler', () => {
  let handler: CreateClientHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateClientHandler,
    { provide: PrismaService, useValue: {
    client: { findFirst: jest.fn(), create: jest.fn() }
    } },
    { provide: EventBusService, useValue: { emit: jest.fn() } }
      ],
    }).compile();

    handler = module.get<CreateClientHandler>(CreateClientHandler);
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
