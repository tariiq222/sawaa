import { Test, TestingModule } from '@nestjs/testing';
import { IntakeFormType, IntakeFormScope } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { CreateIntakeFormHandler } from './create-intake-form.handler';

describe('CreateIntakeFormHandler', () => {
  let handler: CreateIntakeFormHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateIntakeFormHandler,
        { provide: PrismaService, useValue: {
          intakeForm: { create: jest.fn() },
        } },
      ],
    }).compile();

    handler = module.get<CreateIntakeFormHandler>(CreateIntakeFormHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should create intake form with fields', async () => {
    (prisma.intakeForm.create as jest.Mock).mockResolvedValue({ id: 'test', fields: [] });
    await handler.execute({
      nameAr: 'نموذج', nameEn: 'Form', type: IntakeFormType.PRE_SESSION, scope: IntakeFormScope.GLOBAL, scopeId: '', isActive: true,
      fields: [{ labelAr: 'حقل', labelEn: 'Field', fieldType: 'TEXT' as any, isRequired: true, options: [], position: 0 }],
    });
    expect(prisma.intakeForm.create).toHaveBeenCalled();
  });

  it('should create intake form without fields', async () => {
    (prisma.intakeForm.create as jest.Mock).mockResolvedValue({ id: 'test', fields: [] });
    await handler.execute({
      nameAr: 'نموذج', nameEn: 'Form', type: IntakeFormType.PRE_SESSION, scope: IntakeFormScope.GLOBAL, scopeId: '', isActive: true,
      fields: [],
    });
    expect(prisma.intakeForm.create).toHaveBeenCalled();
  });
});
