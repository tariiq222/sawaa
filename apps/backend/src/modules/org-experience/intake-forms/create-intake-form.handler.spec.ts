import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
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
          service: { findUnique: jest.fn() },
          employee: { findUnique: jest.fn() },
          branch: { findUnique: jest.fn() },
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
    (prisma.intakeForm.create as jest.Mock).mockResolvedValue({ id: 'test', fields: [], _count: { responses: 0 } });
    await handler.execute({
      nameAr: 'نموذج', nameEn: 'Form', type: IntakeFormType.PRE_SESSION, scope: IntakeFormScope.GLOBAL, scopeId: '', isActive: true,
      fields: [{ labelAr: 'حقل', labelEn: 'Field', fieldType: 'TEXT' as any, isRequired: true, options: [], position: 0 }],
    });
    expect(prisma.intakeForm.create).toHaveBeenCalled();
  });

  it('should create intake form without fields', async () => {
    (prisma.intakeForm.create as jest.Mock).mockResolvedValue({ id: 'test', fields: [], _count: { responses: 0 } });
    await handler.execute({
      nameAr: 'نموذج', nameEn: 'Form', type: IntakeFormType.PRE_SESSION, scope: IntakeFormScope.GLOBAL, scopeId: '', isActive: true,
      fields: [],
    });
    expect(prisma.intakeForm.create).toHaveBeenCalled();
  });

  it('rejects a scoped form when its target does not exist before creating anything', async () => {
    (prisma as any).service.findUnique.mockResolvedValue(null);

    await expect(handler.execute({
      nameAr: 'نموذج خدمة',
      type: IntakeFormType.PRE_SESSION,
      scope: IntakeFormScope.SERVICE,
      scopeId: 'missing-service',
    })).rejects.toThrow(BadRequestException);

    expect(prisma.intakeForm.create).not.toHaveBeenCalled();
    expect((prisma as any).service.findUnique).toHaveBeenCalledWith({
      where: { id: 'missing-service' },
      select: { id: true },
    });
  });

  it('clears scopeId for GLOBAL forms in the persisted create payload', async () => {
    (prisma.intakeForm.create as jest.Mock).mockResolvedValue({ id: 'test', fields: [], _count: { responses: 0 } });

    await handler.execute({
      nameAr: 'نموذج عام',
      type: IntakeFormType.PRE_SESSION,
      scope: IntakeFormScope.GLOBAL,
      scopeId: 'stale-target',
    });

    expect(prisma.intakeForm.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ scope: IntakeFormScope.GLOBAL, scopeId: null }),
    }));
  });
});
