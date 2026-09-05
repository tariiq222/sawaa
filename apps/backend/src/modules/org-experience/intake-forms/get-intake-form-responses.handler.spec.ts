import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { GetIntakeFormResponsesHandler } from './get-intake-form-responses.handler';

const makeResponse = (overrides: Partial<{ scope: string; scopeId: string | null; formId: string; supersededAt: Date | null }> = {}) => ({
  id: 'resp-1',
  formId: overrides.formId ?? 'form-1',
  bookingId: 'booking-1',
  clientId: 'client-1',
  answers: { field1: 'نعم' },
  createdAt: new Date('2026-05-19T10:00:00Z'),
  supersededAt: overrides.supersededAt ?? null,
  form: {
    id: overrides.formId ?? 'form-1',
    nameAr: 'نموذج',
    nameEn: null,
    type: 'PRE_SESSION',
    scope: overrides.scope ?? 'GLOBAL',
    scopeId: overrides.scopeId ?? null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    fields: [{ id: 'field1', labelAr: 'حقل', labelEn: null, fieldType: 'TEXT', isRequired: false, options: null, position: 0, createdAt: new Date(), updatedAt: new Date(), formId: 'form-1' }],
  },
});

const buildHandler = async (prismaValue: Record<string, unknown>) => {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      GetIntakeFormResponsesHandler,
      { provide: PrismaService, useValue: prismaValue },
    ],
  }).compile();
  return module.get<GetIntakeFormResponsesHandler>(GetIntakeFormResponsesHandler);
};

describe('GetIntakeFormResponsesHandler', () => {
  it('reads only current responses and counts only current rows', async () => {
    const findMany = jest.fn().mockResolvedValue([makeResponse()]);
    const groupBy = jest.fn().mockResolvedValue([{ formId: 'form-1', _count: 1 }]);
    const handler = await buildHandler({
      intakeResponse: { findMany, groupBy },
      service: { findMany: jest.fn() },
      employee: { findMany: jest.fn() },
      branch: { findMany: jest.fn() },
    });

    await handler.execute({ bookingId: 'booking-1' });

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { bookingId: 'booking-1', supersededAt: null },
    }));
    expect(groupBy).toHaveBeenCalledWith(expect.objectContaining({
      where: { formId: { in: ['form-1'] }, supersededAt: null },
    }));
  });

  it('returns mapped responses with null scope label for GLOBAL forms and real submission count', async () => {
    const handler = await buildHandler({
      intakeResponse: {
        findMany: jest.fn().mockResolvedValue([makeResponse()]),
        groupBy: jest.fn().mockResolvedValue([{ formId: 'form-1', _count: 3 }]),
      },
      service: { findUnique: jest.fn() },
      employee: { findUnique: jest.fn() },
      branch: { findUnique: jest.fn() },
    });

    const result = await handler.execute({ bookingId: 'booking-1' });
    expect(result).toHaveLength(1);
    expect(result[0].form.type).toBe('pre_session');
    expect(result[0].form.scopeLabel).toBeNull();
    expect(result[0].form.serviceId).toBeNull();
    expect(result[0].form.submissionsCount).toBe(3);
  });

  it('resolves the service name as the scope label for SERVICE-scoped forms', async () => {
    const handler = await buildHandler({
      intakeResponse: {
        findMany: jest.fn().mockResolvedValue([makeResponse({ scope: 'SERVICE', scopeId: 'svc-1' })]),
        groupBy: jest.fn().mockResolvedValue([{ formId: 'form-1', _count: 1 }]),
      },
      service: { findMany: jest.fn().mockResolvedValue([{ id: 'svc-1', nameAr: 'استشارة أسرية' }]) },
      employee: { findUnique: jest.fn() },
      branch: { findUnique: jest.fn() },
    });

    const result = await handler.execute({ bookingId: 'booking-1' });
    expect(result[0].form.scopeLabel).toBe('استشارة أسرية');
    expect(result[0].form.serviceId).toBe('svc-1');
    expect(result[0].form.employeeId).toBeNull();
  });

  it('resolves the employee name for EMPLOYEE-scoped forms', async () => {
    const handler = await buildHandler({
      intakeResponse: {
        findMany: jest.fn().mockResolvedValue([makeResponse({ scope: 'EMPLOYEE', scopeId: 'emp-1' })]),
        groupBy: jest.fn().mockResolvedValue([{ formId: 'form-1', _count: 2 }]),
      },
      service: { findUnique: jest.fn() },
      employee: { findMany: jest.fn().mockResolvedValue([{ id: 'emp-1', name: 'د. منى' }]) },
      branch: { findUnique: jest.fn() },
    });

    const result = await handler.execute({ bookingId: 'booking-1' });
    expect(result[0].form.scopeLabel).toBe('د. منى');
    expect(result[0].form.employeeId).toBe('emp-1');
  });

  it('resolves the branch name for BRANCH-scoped forms', async () => {
    const handler = await buildHandler({
      intakeResponse: {
        findMany: jest.fn().mockResolvedValue([makeResponse({ scope: 'BRANCH', scopeId: 'br-1' })]),
        groupBy: jest.fn().mockResolvedValue([{ formId: 'form-1', _count: 1 }]),
      },
      service: { findUnique: jest.fn() },
      employee: { findUnique: jest.fn() },
      branch: { findMany: jest.fn().mockResolvedValue([{ id: 'br-1', nameAr: 'فرع الرياض' }]) },
    });

    const result = await handler.execute({ bookingId: 'booking-1' });
    expect(result[0].form.scopeLabel).toBe('فرع الرياض');
    expect(result[0].form.branchId).toBe('br-1');
  });

  it('loads scope labels in one query per scope type instead of one query per form', async () => {
    const serviceFindMany = jest.fn().mockResolvedValue([
      { id: 'svc-1', nameAr: 'استشارة أسرية' },
      { id: 'svc-2', nameAr: 'استشارة زوجية' },
    ]);
    const handler = await buildHandler({
      intakeResponse: {
        findMany: jest.fn().mockResolvedValue([
          makeResponse({ formId: 'form-1', scope: 'SERVICE', scopeId: 'svc-1' }),
          makeResponse({ formId: 'form-2', scope: 'SERVICE', scopeId: 'svc-2' }),
        ]),
        groupBy: jest.fn().mockResolvedValue([
          { formId: 'form-1', _count: 1 },
          { formId: 'form-2', _count: 1 },
        ]),
      },
      service: {
        findMany: serviceFindMany,
        findUnique: jest.fn().mockResolvedValue({ nameAr: 'legacy per-form lookup' }),
      },
      employee: { findMany: jest.fn(), findUnique: jest.fn() },
      branch: { findMany: jest.fn(), findUnique: jest.fn() },
    });

    const result = await handler.execute({ bookingId: 'booking-1' });

    expect(result.map((response) => response.form.scopeLabel)).toEqual([
      'استشارة أسرية',
      'استشارة زوجية',
    ]);
    expect(serviceFindMany).toHaveBeenCalledTimes(1);
    expect(serviceFindMany).toHaveBeenCalledWith({
      where: { id: { in: ['svc-1', 'svc-2'] } },
      select: { id: true, nameAr: true },
    });
  });

  it('returns empty array when no responses exist', async () => {
    const handler = await buildHandler({
      intakeResponse: { findMany: jest.fn().mockResolvedValue([]), groupBy: jest.fn() },
      service: { findUnique: jest.fn() },
      employee: { findUnique: jest.fn() },
      branch: { findUnique: jest.fn() },
    });
    const result = await handler.execute({ bookingId: 'missing' });
    expect(result).toHaveLength(0);
  });
});
