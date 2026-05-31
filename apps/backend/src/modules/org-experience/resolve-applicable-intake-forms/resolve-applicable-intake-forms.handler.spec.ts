import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { ResolveApplicableIntakeFormsHandler } from './resolve-applicable-intake-forms.handler';

describe('ResolveApplicableIntakeFormsHandler', () => {
  let handler: ResolveApplicableIntakeFormsHandler;
  let findMany: jest.Mock;

  beforeEach(async () => {
    findMany = jest.fn().mockResolvedValue([]);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResolveApplicableIntakeFormsHandler,
        { provide: PrismaService, useValue: { intakeForm: { findMany } } },
      ],
    }).compile();
    handler = module.get(ResolveApplicableIntakeFormsHandler);
  });

  it('always includes GLOBAL scope and filters by isActive', async () => {
    await handler.execute({});
    const where = findMany.mock.calls[0][0].where;
    expect(where.isActive).toBe(true);
    expect(where.OR).toEqual([{ scope: 'GLOBAL' }]);
    expect(where.type).toBeUndefined();
  });

  it('unions SERVICE/EMPLOYEE/BRANCH scopes when ids are supplied', async () => {
    await handler.execute({ serviceId: 'svc-1', employeeId: 'emp-1', branchId: 'br-1' });
    const where = findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual([
      { scope: 'GLOBAL' },
      { scope: 'SERVICE', scopeId: 'svc-1' },
      { scope: 'EMPLOYEE', scopeId: 'emp-1' },
      { scope: 'BRANCH', scopeId: 'br-1' },
    ]);
  });

  it('applies the type filter when provided', async () => {
    await handler.execute({ type: 'PRE_BOOKING' as never });
    expect(findMany.mock.calls[0][0].where.type).toBe('PRE_BOOKING');
  });

  it('maps forms with lowercased enums and ordered fields', async () => {
    findMany.mockResolvedValueOnce([
      {
        id: 'form-1',
        nameAr: 'نموذج',
        nameEn: null,
        type: 'PRE_SESSION',
        scope: 'GLOBAL',
        scopeId: null,
        isActive: true,
        fields: [
          { id: 'f1', labelAr: 'حقل', labelEn: null, fieldType: 'SELECT', isRequired: true, options: ['a', 'b'], position: 0 },
        ],
      },
    ]);
    const result = await handler.execute({});
    expect(result[0].type).toBe('pre_session');
    expect(result[0].scope).toBe('global');
    expect(result[0].fields[0].fieldType).toBe('select');
    expect(result[0].fields[0].options).toEqual(['a', 'b']);
  });

  it('defaults options to an empty array when null', async () => {
    findMany.mockResolvedValueOnce([
      {
        id: 'form-1', nameAr: 'x', nameEn: null, type: 'PRE_SESSION', scope: 'GLOBAL', scopeId: null, isActive: true,
        fields: [{ id: 'f1', labelAr: 'h', labelEn: null, fieldType: 'TEXT', isRequired: false, options: null, position: 0 }],
      },
    ]);
    const result = await handler.execute({});
    expect(result[0].fields[0].options).toEqual([]);
  });
});
