import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { UpdateIntakeFormHandler } from './update-intake-form.handler';

const mockForm = {
  id: 'form-1',
  nameAr: 'نموذج معدّل',
  nameEn: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  fields: [],
};

const buildPrisma = () => ({
  intakeForm: {
    update: jest.fn().mockResolvedValue(mockForm),
  },
});

describe('UpdateIntakeFormHandler', () => {
  it('updates form successfully', async () => {
    const prisma = buildPrisma();
    const handler = new UpdateIntakeFormHandler(prisma as never);
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
    const p2025 = new Prisma.PrismaClientKnownRequestError('Record not found', {
      code: 'P2025',
      clientVersion: '5.0.0',
    });
    prisma.intakeForm.update = jest.fn().mockRejectedValue(p2025);
    const handler = new UpdateIntakeFormHandler(prisma as never);
    await expect(handler.execute({ formId: 'missing' })).rejects.toThrow(NotFoundException);
  });
});
