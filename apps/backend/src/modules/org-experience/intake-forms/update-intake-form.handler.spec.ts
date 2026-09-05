import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { IntakeFieldType, IntakeFormScope } from '@prisma/client';
import { UpdateIntakeFormHandler } from './update-intake-form.handler';

const mockForm = {
  id: 'form-1',
  nameAr: 'نموذج معدّل',
  nameEn: null,
  type: 'PRE_SESSION',
  scope: 'GLOBAL',
  scopeId: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  fields: [],
  _count: { responses: 0 },
};

const buildPrisma = () => ({
  intakeForm: {
    update: jest.fn().mockResolvedValue(mockForm),
    findUnique: jest.fn().mockResolvedValue(mockForm),
    findFirst: jest.fn().mockResolvedValue(mockForm),
  },
  $queryRaw: jest.fn().mockResolvedValue([]),
  service: { findUnique: jest.fn().mockResolvedValue({ id: 'service-1' }) },
  employee: { findUnique: jest.fn().mockResolvedValue({ id: 'employee-1' }) },
  branch: { findUnique: jest.fn().mockResolvedValue({ id: 'branch-1' }) },
  intakeField: {
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    createMany: jest.fn().mockResolvedValue({ count: 1 }),
  },
  intakeResponse: { count: jest.fn().mockResolvedValue(0) },
});

const buildTransaction = (prisma: ReturnType<typeof buildPrisma>) => ({
  withTransaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
});

describe('UpdateIntakeFormHandler', () => {
  it('updates form successfully', async () => {
    const prisma = buildPrisma();
    const handler = new UpdateIntakeFormHandler(prisma as never, buildTransaction(prisma) as never);
    const result = await handler.execute({ formId: 'form-1', nameAr: 'نموذج معدّل' });
    expect(prisma.intakeForm.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'form-1' },
        data: expect.objectContaining({ nameAr: 'نموذج معدّل' }),
      }),
    );
    expect(result.nameAr).toBe('نموذج معدّل');
  });

  it('throws NotFoundException when formId not found', async () => {
    const prisma = buildPrisma();
    prisma.intakeForm.findUnique.mockResolvedValue(null);
    const handler = new UpdateIntakeFormHandler(prisma as never, buildTransaction(prisma) as never);
    await expect(handler.execute({ formId: 'missing' })).rejects.toThrow(NotFoundException);
  });

  it('preserves existing field IDs when fields are omitted from a metadata update', async () => {
    const prisma = buildPrisma();
    const rls = buildTransaction(prisma);
    const handler = new UpdateIntakeFormHandler(prisma as never, rls as never);

    await handler.execute({ formId: 'form-1', nameAr: 'اسم جديد' });

    expect(prisma.intakeField.deleteMany).not.toHaveBeenCalled();
    expect(prisma.intakeField.createMany).not.toHaveBeenCalled();
    expect(prisma.intakeForm.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ nameAr: 'اسم جديد' }),
    }));
  });

  it('clears scopeId when changing a form to GLOBAL', async () => {
    const prisma = buildPrisma();
    prisma.intakeForm.findUnique.mockResolvedValue({ ...mockForm, scope: IntakeFormScope.SERVICE, scopeId: 'service-1' });
    const handler = new UpdateIntakeFormHandler(prisma as never, buildTransaction(prisma) as never);

    await handler.execute({ formId: 'form-1', scope: IntakeFormScope.GLOBAL });

    expect(prisma.intakeForm.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ scope: IntakeFormScope.GLOBAL, scopeId: null }),
    }));
  });

  it('rejects a scope change without a replacement target before writing', async () => {
    const prisma = buildPrisma();
    prisma.intakeForm.findUnique.mockResolvedValue({ ...mockForm, scope: IntakeFormScope.SERVICE, scopeId: 'service-1' });
    const handler = new UpdateIntakeFormHandler(prisma as never, buildTransaction(prisma) as never);

    await expect(handler.execute({ formId: 'form-1', scope: IntakeFormScope.EMPLOYEE }))
      .rejects.toThrow(BadRequestException);

    expect(prisma.intakeForm.update).not.toHaveBeenCalled();
  });

  it('rejects an invalid scope target before writing', async () => {
    const prisma = buildPrisma();
    prisma.service.findUnique.mockResolvedValue(null);
    const handler = new UpdateIntakeFormHandler(prisma as never, buildTransaction(prisma) as never);

    await expect(handler.execute({
      formId: 'form-1',
      scope: IntakeFormScope.SERVICE,
      scopeId: 'missing-service',
    })).rejects.toThrow(BadRequestException);

    expect(prisma.intakeForm.update).not.toHaveBeenCalled();
  });

  it('allows an answered form metadata update when submitted fields are semantically unchanged', async () => {
    const fields = [{
      id: 'field-1',
      formId: 'form-1',
      labelAr: 'سؤال',
      labelEn: null,
      fieldType: IntakeFieldType.TEXT,
      isRequired: false,
      options: null,
      position: 0,
    }];
    const prisma = buildPrisma();
    prisma.intakeForm.findUnique.mockResolvedValue({ ...mockForm, fields, _count: { responses: 2 } });
    const handler = new UpdateIntakeFormHandler(prisma as never, buildTransaction(prisma) as never);

    await handler.execute({
      formId: 'form-1',
      nameAr: 'اسم محدث',
      fields: [{ labelAr: 'سؤال', fieldType: IntakeFieldType.TEXT, isRequired: false }],
    });

    expect(prisma.intakeForm.update).toHaveBeenCalled();
    expect(prisma.intakeField.deleteMany).not.toHaveBeenCalled();
    expect(prisma.intakeField.createMany).not.toHaveBeenCalled();
  });

  it('rejects structural field changes on an answered form without a metadata partial write', async () => {
    const prisma = buildPrisma();
    prisma.intakeForm.findUnique.mockResolvedValue({
      ...mockForm,
      fields: [{ id: 'field-1', labelAr: 'قديم', labelEn: null, fieldType: IntakeFieldType.TEXT, isRequired: false, options: null, position: 0 }],
      _count: { responses: 1 },
    });
    prisma.intakeResponse.count.mockResolvedValue(1);
    const handler = new UpdateIntakeFormHandler(prisma as never, buildTransaction(prisma) as never);

    await expect(handler.execute({
      formId: 'form-1',
      nameAr: 'يجب ألا يحفظ',
      fields: [{ labelAr: 'جديد', fieldType: IntakeFieldType.TEXT }],
    })).rejects.toThrow(ConflictException);

    expect(prisma.intakeForm.update).not.toHaveBeenCalled();
    expect(prisma.intakeField.deleteMany).not.toHaveBeenCalled();
  });
});
