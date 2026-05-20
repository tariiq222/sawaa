import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { GetIntakeFormResponsesHandler } from './get-intake-form-responses.handler';

describe('GetIntakeFormResponsesHandler', () => {
  let handler: GetIntakeFormResponsesHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetIntakeFormResponsesHandler,
        { provide: PrismaService, useValue: { intakeResponse: { findMany: jest.fn() } } },
      ],
    }).compile();

    handler = module.get<GetIntakeFormResponsesHandler>(GetIntakeFormResponsesHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should return mapped responses', async () => {
    (prisma.intakeResponse.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'resp-1',
        formId: 'form-1',
        bookingId: 'booking-1',
        clientId: 'client-1',
        answers: { field1: 'نعم' },
        createdAt: new Date('2026-05-19T10:00:00Z'),
        form: {
          id: 'form-1',
          nameAr: 'نموذج',
          nameEn: null,
          type: 'PRE_SESSION',
          scope: 'GLOBAL',
          scopeId: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          fields: [{ id: 'field1', labelAr: 'حقل', labelEn: null, fieldType: 'TEXT', isRequired: false, options: null, position: 0, createdAt: new Date(), updatedAt: new Date(), formId: 'form-1' }],
        },
      },
    ]);

    const result = await handler.execute({ bookingId: 'booking-1' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('resp-1');
    expect(result[0].answers).toEqual({ field1: 'نعم' });
    expect(result[0].form.type).toBe('pre_session');
    expect(prisma.intakeResponse.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { bookingId: 'booking-1' },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      }),
    );
  });

  it('should return empty array when no responses exist', async () => {
    (prisma.intakeResponse.findMany as jest.Mock).mockResolvedValue([]);
    const result = await handler.execute({ bookingId: 'missing' });
    expect(result).toHaveLength(0);
  });
});
