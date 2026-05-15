import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { GetIntakeFormHandler } from './get-intake-form.handler';

describe('GetIntakeFormHandler', () => {
  let handler: GetIntakeFormHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetIntakeFormHandler,
        { provide: PrismaService, useValue: {
    intakeForm: { findFirst: jest.fn() }
        } },
      ],
    }).compile();

    handler = module.get<GetIntakeFormHandler>(GetIntakeFormHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should execute successfully', async () => {
    (prisma.intakeForm.findFirst as jest.Mock).mockResolvedValue({ id: 'test-id' });
    const result = await handler.execute({formId:"00000000-0000-0000-0000-000000000001"});
    expect(result).toBeDefined();
    
    (prisma.intakeForm.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(handler.execute({formId:"00000000-0000-0000-0000-000000000001"})).rejects.toThrow();
  });
});
