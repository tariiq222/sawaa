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
    (prisma.intakeForm.findFirst as jest.Mock).mockResolvedValue({
      id: 'test-id',
      type: 'PRE_SESSION',
      scope: 'GLOBAL',
      _count: { responses: 0 },
    });
    const result = await handler.execute({formId:"00000000-0000-0000-0000-000000000001"});
    expect(result).toBeDefined();
    expect(result.type).toBe('PRE_SESSION');
    expect(result.scope).toBe('GLOBAL');
    expect(result.submissionsCount).toBe(0);
    expect(result).not.toHaveProperty('_count');
    expect(prisma.intakeForm.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      include: expect.objectContaining({
        _count: {
          select: { responses: { where: { supersededAt: null } } },
        },
      }),
    }));
    
    (prisma.intakeForm.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(handler.execute({formId:"00000000-0000-0000-0000-000000000001"})).rejects.toThrow();
  });
});
