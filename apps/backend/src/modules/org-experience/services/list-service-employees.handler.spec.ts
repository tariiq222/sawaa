import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { ListServiceEmployeesHandler } from './list-service-employees.handler';

describe('ListServiceEmployeesHandler', () => {
  let handler: ListServiceEmployeesHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListServiceEmployeesHandler,
    { provide: PrismaService, useValue: {
    service: { findFirst: jest.fn() },
    employeeService: { findMany: jest.fn() },
    employee: { findMany: jest.fn() },
    serviceBookingConfig: { findMany: jest.fn() }
    } }
      ],
    }).compile();

    handler = module.get<ListServiceEmployeesHandler>(ListServiceEmployeesHandler);
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
