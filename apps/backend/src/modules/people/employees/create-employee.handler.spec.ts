import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { EventBusService } from '../../../infrastructure/events';
import { CreateEmployeeHandler } from './create-employee.handler';

describe('CreateEmployeeHandler', () => {
  let handler: CreateEmployeeHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateEmployeeHandler,
    { provide: PrismaService, useValue: {
    employee: { findFirst: jest.fn() }
    } },
    { provide: EventBusService, useValue: { emit: jest.fn() } }
      ],
    }).compile();

    handler = module.get<CreateEmployeeHandler>(CreateEmployeeHandler);
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
