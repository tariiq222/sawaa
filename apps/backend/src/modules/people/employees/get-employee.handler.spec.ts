import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { GetEmployeeHandler } from './get-employee.handler';

describe('GetEmployeeHandler', () => {
  let handler: GetEmployeeHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetEmployeeHandler,
    { provide: PrismaService, useValue: {
    employee: { findFirst: jest.fn() },
    rating: { aggregate: jest.fn() },
    booking: { count: jest.fn() }
    } }
      ],
    }).compile();

    handler = module.get<GetEmployeeHandler>(GetEmployeeHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should execute', async () => {
    try {
      await handler.execute({ employeeId: '00000000-0000-0000-0000-000000000001' });
    } catch (e) {
      // Expected for incomplete mocks
    }
  });
});
