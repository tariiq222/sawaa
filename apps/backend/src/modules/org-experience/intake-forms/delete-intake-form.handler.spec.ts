import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { DeleteIntakeFormHandler } from './delete-intake-form.handler';

describe('DeleteIntakeFormHandler', () => {
  let handler: DeleteIntakeFormHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeleteIntakeFormHandler,
        { provide: PrismaService, useValue: {
    intakeForm: { findFirst: jest.fn(), delete: jest.fn() }
        } },
      ],
    }).compile();

    handler = module.get<DeleteIntakeFormHandler>(DeleteIntakeFormHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should execute', async () => {
    (prisma.intakeForm.findFirst as jest.Mock).mockResolvedValue({ id: 'test' });
    await handler.execute({});
    
    (prisma.intakeForm.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(handler.execute({})).rejects.toThrow();
  });
});
