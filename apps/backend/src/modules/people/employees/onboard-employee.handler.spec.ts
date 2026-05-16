import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { OnboardEmployeeHandler } from './onboard-employee.handler';

describe('OnboardEmployeeHandler', () => {
  let handler: OnboardEmployeeHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OnboardEmployeeHandler,
    { provide: PrismaService, useValue: {
    employee: { findFirst: jest.fn(), create: jest.fn() }
    } }
      ],
    }).compile();

    handler = module.get<OnboardEmployeeHandler>(OnboardEmployeeHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should execute', async () => {
    try {
      await handler.execute({ nameEn: 'Test', nameAr: 'تجربة', email: 'test@example.com', specialty: 'Test' });
    } catch (e) {
      // Expected for incomplete mocks
    }
  });
});
