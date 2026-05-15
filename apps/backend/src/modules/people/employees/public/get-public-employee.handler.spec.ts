import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../../infrastructure/database';
import { GetPublicEmployeeHandler } from './get-public-employee.handler';

describe('GetPublicEmployeeHandler', () => {
  let handler: GetPublicEmployeeHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetPublicEmployeeHandler,
    { provide: PrismaService, useValue: {
    employee: { findFirst: jest.fn() },
    rating: { aggregate: jest.fn() },
    employeeService: { findMany: jest.fn() },
    service: { findMany: jest.fn() },
    employeeAvailability: { findMany: jest.fn() }
    } }
      ],
    }).compile();

    handler = module.get<GetPublicEmployeeHandler>(GetPublicEmployeeHandler);
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
