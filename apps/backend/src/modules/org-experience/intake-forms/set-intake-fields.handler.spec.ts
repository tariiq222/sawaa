import { ConflictException, NotFoundException } from '@nestjs/common';
import { IntakeFieldType } from '@prisma/client';
import { SetIntakeFieldsHandler } from './set-intake-fields.handler';

const mockForm = {
  id: 'form-1',
  nameAr: 'استمارة',
  nameEn: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  _count: { responses: 0 },
  fields: [
    {
      id: 'field-1',
      formId: 'form-1',
      labelAr: 'هل لديك حساسية؟',
      labelEn: null,
      fieldType: IntakeFieldType.TEXT,
      isRequired: false,
      options: null,
      position: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
};

const buildPrisma = () => ({
  intakeForm: {
    findFirst: jest.fn().mockResolvedValue({ id: 'form-1' }),
    findUnique: jest.fn().mockResolvedValue(mockForm),
  },
  intakeField: {
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    createMany: jest.fn().mockResolvedValue({ count: 1 }),
  },
  intakeResponse: { count: jest.fn().mockResolvedValue(0) },
  $transaction: jest.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      intakeForm: {
        findFirst: jest.fn().mockResolvedValue({ id: 'form-1' }),
        findUnique: jest.fn().mockResolvedValue(mockForm),
      },
      $queryRaw: jest.fn().mockResolvedValue([]),
      intakeResponse: { count: jest.fn().mockResolvedValue(0) },
      intakeField: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    return fn(tx);
  }),
});

const buildRlsTransaction = (prisma: ReturnType<typeof buildPrisma>) => ({
  withTransaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => prisma.$transaction(fn)),
});

describe('SetIntakeFieldsHandler', () => {
  it('replaces fields atomically', async () => {
    const prisma = buildPrisma();
    const rlsTransaction = buildRlsTransaction(prisma);
    const handler = new SetIntakeFieldsHandler(prisma as never, rlsTransaction as never);
    const result = await handler.execute({
      formId: 'form-1',
      fields: [{ labelAr: 'هل لديك حساسية؟', fieldType: IntakeFieldType.TEXT }],
    });
    expect(rlsTransaction.withTransaction).toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it('throws NotFoundException when form not found', async () => {
    const prisma = buildPrisma();
    prisma.$transaction = jest.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        intakeForm: {
          findFirst: jest.fn().mockResolvedValue(null),
          findUnique: jest.fn().mockResolvedValue(null),
        },
        $queryRaw: jest.fn().mockResolvedValue([]),
        intakeField: {
          deleteMany: jest.fn(),
          createMany: jest.fn(),
        },
      };
      return fn(tx);
    });
    const rlsTransaction = buildRlsTransaction(prisma);
    const handler = new SetIntakeFieldsHandler(prisma as never, rlsTransaction as never);
    await expect(
      handler.execute({ formId: 'missing', fields: [] }),
    ).rejects.toThrow(NotFoundException);
  });

  it.each([0, 10])('keeps field IDs for unchanged answered fields at stored position %s', async (position) => {
    const existingField = {
      id: 'field-1',
      formId: 'form-1',
      labelAr: 'هل لديك حساسية؟',
      labelEn: null,
      fieldType: IntakeFieldType.TEXT,
      isRequired: false,
      options: null,
      position,
    };
    const tx = {
      intakeForm: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'form-1',
          fields: [existingField],
          _count: { responses: 1 },
        }),
        findUnique: jest.fn().mockResolvedValue({ id: 'form-1', fields: [existingField] }),
      },
      $queryRaw: jest.fn().mockResolvedValue([]),
      intakeResponse: { count: jest.fn().mockResolvedValue(0) },
      intakeField: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
    };
    const rls = { withTransaction: jest.fn((fn: (value: unknown) => Promise<unknown>) => fn(tx)) };
    const handler = new SetIntakeFieldsHandler({} as never, rls as never);

    await handler.execute({
      formId: 'form-1',
      fields: [{ labelAr: 'هل لديك حساسية؟', fieldType: IntakeFieldType.TEXT }],
    });

    expect(tx.intakeField.deleteMany).not.toHaveBeenCalled();
    expect(tx.intakeField.createMany).not.toHaveBeenCalled();
  });

  it('rejects structural changes on an answered form before deleting its fields', async () => {
    const tx = {
      intakeForm: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'form-1',
          fields: [mockForm.fields[0]],
          _count: { responses: 1 },
        }),
        findUnique: jest.fn().mockResolvedValue(mockForm),
      },
      $queryRaw: jest.fn().mockResolvedValue([]),
      intakeResponse: { count: jest.fn().mockResolvedValue(1) },
      intakeField: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
    };
    const rls = { withTransaction: jest.fn((fn: (value: unknown) => Promise<unknown>) => fn(tx)) };
    const handler = new SetIntakeFieldsHandler({} as never, rls as never);

    await expect(handler.execute({
      formId: 'form-1',
      fields: [{ labelAr: 'سؤال مختلف', fieldType: IntakeFieldType.TEXT }],
    })).rejects.toThrow(ConflictException);

    expect(tx.intakeField.deleteMany).not.toHaveBeenCalled();
    expect(tx.intakeField.createMany).not.toHaveBeenCalled();
  });

  it('propagates replacement failure through the transaction boundary', async () => {
    const prisma = buildPrisma();
    const tx = {
      intakeForm: {
        findFirst: jest.fn().mockResolvedValue({ id: 'form-1', fields: [], _count: { responses: 0 } }),
        findUnique: jest.fn().mockResolvedValue(mockForm),
      },
      $queryRaw: jest.fn().mockResolvedValue([]),
      intakeResponse: { count: jest.fn().mockResolvedValue(0) },
      intakeField: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        createMany: jest.fn().mockRejectedValue(new Error('write failed')),
      },
    };
    const rls = { withTransaction: jest.fn((fn: (value: unknown) => Promise<unknown>) => fn(tx)) };
    const handler = new SetIntakeFieldsHandler(prisma as never, rls as never);

    await expect(handler.execute({
      formId: 'form-1',
      fields: [{ labelAr: 'سؤال', fieldType: IntakeFieldType.TEXT }],
    })).rejects.toThrow('write failed');
    expect(rls.withTransaction).toHaveBeenCalledTimes(1);
  });
});
