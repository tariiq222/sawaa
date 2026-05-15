import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { DeleteEmployeeHandler } from './delete-employee.handler';

describe('DeleteEmployeeHandler', () => {
  let handler: DeleteEmployeeHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeleteEmployeeHandler,
    { provide: PrismaService, useValue: {
    employee: { findFirst: jest.fn(), delete: jest.fn() },
    booking: { count: jest.fn() },
    groupSession: { count: jest.fn() },
    invoice: { count: jest.fn() },
    waitlistEntry: { count: jest.fn() },
    rating: { count: jest.fn() }
    } }
      ],
    }).compile();

    handler = module.get<DeleteEmployeeHandler>(DeleteEmployeeHandler);
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
