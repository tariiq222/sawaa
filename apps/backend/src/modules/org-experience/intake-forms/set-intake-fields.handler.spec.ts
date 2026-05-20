import { NotFoundException } from '@nestjs/common';
import { IntakeFieldType } from '@prisma/client';
import { SetIntakeFieldsHandler } from './set-intake-fields.handler';

const mockForm = {
  id: 'form-1',
  nameAr: 'استمارة',
  nameEn: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
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
  $transaction: jest.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      intakeForm: {
        findFirst: jest.fn().mockResolvedValue({ id: 'form-1' }),
        findUnique: jest.fn().mockResolvedValue(mockForm),
      },
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
});
