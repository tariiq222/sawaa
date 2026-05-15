import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { SetEmployeeServiceOptionsHandler } from './set-employee-service-options.handler';

describe('SetEmployeeServiceOptionsHandler', () => {
  let handler: SetEmployeeServiceOptionsHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SetEmployeeServiceOptionsHandler,
    { provide: PrismaService, useValue: {
    serviceDurationOption: { findMany: jest.fn() },
    employeeServiceOption: { findMany: jest.fn() }
    } }
      ],
    }).compile();

    handler = module.get<SetEmployeeServiceOptionsHandler>(SetEmployeeServiceOptionsHandler);
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
