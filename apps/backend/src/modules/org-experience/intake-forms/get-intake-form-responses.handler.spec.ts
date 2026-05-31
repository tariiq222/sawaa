import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { GetIntakeFormResponsesHandler } from './get-intake-form-responses.handler';

const makeResponse = (overrides: Partial<{ scope: string; scopeId: string | null; formId: string }> = {}) => ({
  id: 'resp-1',
  formId: overrides.formId ?? 'form-1',
  bookingId: 'booking-1',
  clientId: 'client-1',
  answers: { field1: 'نعم' },
  createdAt: new Date('2026-05-19T10:00:00Z'),
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
  it('returns mapped responses with null scope label for GLOBAL forms and real submission count', async () => {
    const handler = await buildHandler({
      intakeResponse: {
        findMany: jest.fn().mockResolvedValue([makeResponse()]),
        count: jest.fn().mockResolvedValue(3),
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
        count: jest.fn().mockResolvedValue(1),
      },
      service: { findUnique: jest.fn().mockResolvedValue({ nameAr: 'استشارة أسرية' }) },
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
        count: jest.fn().mockResolvedValue(2),
      },
      service: { findUnique: jest.fn() },
      employee: { findUnique: jest.fn().mockResolvedValue({ name: 'د. منى' }) },
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
        count: jest.fn().mockResolvedValue(1),
      },
      service: { findUnique: jest.fn() },
      employee: { findUnique: jest.fn() },
      branch: { findUnique: jest.fn().mockResolvedValue({ nameAr: 'فرع الرياض' }) },
    });

    const result = await handler.execute({ bookingId: 'booking-1' });
    expect(result[0].form.scopeLabel).toBe('فرع الرياض');
    expect(result[0].form.branchId).toBe('br-1');
  });

  it('returns empty array when no responses exist', async () => {
    const handler = await buildHandler({
      intakeResponse: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn() },
      service: { findUnique: jest.fn() },
      employee: { findUnique: jest.fn() },
      branch: { findUnique: jest.fn() },
    });
    const result = await handler.execute({ bookingId: 'missing' });
    expect(result).toHaveLength(0);
  });
});
