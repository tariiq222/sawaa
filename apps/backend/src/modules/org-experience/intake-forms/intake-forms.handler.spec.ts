import { NotFoundException } from '@nestjs/common';
import { IntakeFormType, IntakeFormScope } from '@prisma/client';
import { CreateIntakeFormHandler } from './create-intake-form.handler';
import { DeleteIntakeFormHandler } from './delete-intake-form.handler';
import { GetIntakeFormHandler } from './get-intake-form.handler';
import { ListIntakeFormsHandler } from './list-intake-forms.handler';
import { TenantContextService } from '../../../common/tenant';

const DEFAULT_ORG = '00000000-0000-0000-0000-000000000001';

const mockForm = {
  id: 'form-1',
  organizationId: DEFAULT_ORG,
  nameAr: 'استمارة المريض',
  nameEn: null,
  type: IntakeFormType.PRE_SESSION,
  scope: IntakeFormScope.GLOBAL,
  scopeId: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  fields: [],
};

const buildPrisma = () => ({
  intakeForm: {
    create: jest.fn().mockResolvedValue(mockForm),
    findFirst: jest.fn().mockResolvedValue(mockForm),
    findMany: jest.fn().mockResolvedValue([mockForm]),
    delete: jest.fn().mockResolvedValue(undefined),
  },
});

const buildTenant = (organizationId = DEFAULT_ORG) =>
  ({
    requireOrganizationId: jest.fn().mockReturnValue(organizationId),
  }) as unknown as TenantContextService;

describe('CreateIntakeFormHandler', () => {
  it('creates form scoped by org', async () => {
    const prisma = buildPrisma();
    const handler = new CreateIntakeFormHandler(prisma as never, buildTenant());
    const result = await handler.execute({
      nameAr: 'استمارة المريض',
      type: IntakeFormType.PRE_SESSION,
      scope: IntakeFormScope.GLOBAL,
    });
    expect(prisma.intakeForm.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ organizationId: DEFAULT_ORG }) }),
    );
    expect(result.id).toBe('form-1');
  });
});

describe('GetIntakeFormHandler', () => {
  it('returns form scoped by org', async () => {
    const prisma = buildPrisma();
    const handler = new GetIntakeFormHandler(prisma as never, buildTenant());
    const result = await handler.execute({ formId: 'form-1' });
    expect(prisma.intakeForm.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ organizationId: DEFAULT_ORG }) }),
    );
    expect(result.nameAr).toBe('استمارة المريض');
  });

  it('throws NotFoundException when form not found', async () => {
    const prisma = buildPrisma();
    prisma.intakeForm.findFirst = jest.fn().mockResolvedValue(null);
    const handler = new GetIntakeFormHandler(prisma as never, buildTenant());
    await expect(handler.execute({ formId: 'missing' })).rejects.toThrow(NotFoundException);
  });
});

describe('ListIntakeFormsHandler', () => {
  it('returns forms scoped by org', async () => {
    const prisma = buildPrisma();
    const handler = new ListIntakeFormsHandler(prisma as never, buildTenant());
    const result = await handler.execute({});
    expect(prisma.intakeForm.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ organizationId: DEFAULT_ORG }) }),
    );
    expect(result).toHaveLength(1);
  });
});

describe('DeleteIntakeFormHandler', () => {
  it('deletes form scoped by org', async () => {
    const prisma = buildPrisma();
    const handler = new DeleteIntakeFormHandler(prisma as never, buildTenant());
    await expect(handler.execute({ formId: 'form-1' })).resolves.toBeUndefined();
    expect(prisma.intakeForm.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ organizationId: DEFAULT_ORG }) }),
    );
    expect(prisma.intakeForm.delete).toHaveBeenCalledWith({ where: { id: 'form-1' } });
  });

  it('throws NotFoundException when form not found', async () => {
    const prisma = buildPrisma();
    prisma.intakeForm.findFirst = jest.fn().mockResolvedValue(null);
    const handler = new DeleteIntakeFormHandler(prisma as never, buildTenant());
    await expect(handler.execute({ formId: 'missing' })).rejects.toThrow(NotFoundException);
  });
});
