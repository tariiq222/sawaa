import { NotFoundException } from '@nestjs/common';
import { IntakeFormType, IntakeFormScope } from '@prisma/client';
import { CreateIntakeFormHandler } from './create-intake-form.handler';
import { DeleteIntakeFormHandler } from './delete-intake-form.handler';
import { GetIntakeFormHandler } from './get-intake-form.handler';
import { ListIntakeFormsHandler } from './list-intake-forms.handler';

const mockForm = {
  id: 'form-1',
  nameAr: 'استمارة المريض',
  nameEn: null,
  type: IntakeFormType.PRE_SESSION,
  scope: IntakeFormScope.GLOBAL,
  scopeId: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  fields: [],
  _count: { responses: 0 },
};

const buildPrisma = () => ({
  intakeForm: {
    create: jest.fn().mockResolvedValue(mockForm),
    findFirst: jest.fn().mockResolvedValue(mockForm),
    findMany: jest.fn().mockResolvedValue([mockForm]),
    delete: jest.fn().mockResolvedValue(undefined),
  },
  $queryRaw: jest.fn().mockResolvedValue([{ id: 'form-1' }]),
  intakeResponse: { findMany: jest.fn().mockResolvedValue([]) },
  intakeResponseRevision: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
});

const buildRls = (prisma: ReturnType<typeof buildPrisma>) => ({
  withTransaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
});


describe('CreateIntakeFormHandler', () => {
  it('creates form', async () => {
    const prisma = buildPrisma();
    const handler = new CreateIntakeFormHandler(prisma as never);
    const result = await handler.execute({
      nameAr: 'استمارة المريض',
      type: IntakeFormType.PRE_SESSION,
      scope: IntakeFormScope.GLOBAL,
    });
    expect(prisma.intakeForm.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ nameAr: 'استمارة المريض' }) }),
    );
    expect(result.id).toBe('form-1');
  });
});

describe('GetIntakeFormHandler', () => {
  const formUuid = '22222222-2222-4222-8222-222222222222';

  it('returns form by id', async () => {
    const prisma = buildPrisma();
    const handler = new GetIntakeFormHandler(prisma as never);
    const result = await handler.execute({ formId: formUuid });
    expect(prisma.intakeForm.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: formUuid }) }),
    );
    expect(result.nameAr).toBe('استمارة المريض');
  });

  it('throws NotFoundException when form not found', async () => {
    const prisma = buildPrisma();
    prisma.intakeForm.findFirst = jest.fn().mockResolvedValue(null);
    const handler = new GetIntakeFormHandler(prisma as never);
    await expect(handler.execute({ formId: formUuid })).rejects.toThrow(NotFoundException);
  });
});

describe('ListIntakeFormsHandler', () => {
  it('returns forms', async () => {
    const prisma = buildPrisma();
    const handler = new ListIntakeFormsHandler(prisma as never);
    const result = await handler.execute({});
    expect(prisma.intakeForm.findMany).toHaveBeenCalled();
    expect(result).toHaveLength(1);
  });
});

describe('DeleteIntakeFormHandler', () => {
  it('deletes form by id', async () => {
    const prisma = buildPrisma();
    const handler = new DeleteIntakeFormHandler(prisma as never, buildRls(prisma) as never);
    await expect(handler.execute({ formId: 'form-1' })).resolves.toBeUndefined();
    expect(prisma.intakeForm.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: 'form-1' }) }),
    );
    expect(prisma.intakeForm.delete).toHaveBeenCalledWith({ where: { id: 'form-1' } });
  });

  it('throws NotFoundException when form not found', async () => {
    const prisma = buildPrisma();
    prisma.intakeForm.findFirst = jest.fn().mockResolvedValue(null);
    const handler = new DeleteIntakeFormHandler(prisma as never, buildRls(prisma) as never);
    await expect(handler.execute({ formId: 'missing' })).rejects.toThrow(NotFoundException);
  });
});
