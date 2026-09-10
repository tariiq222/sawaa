import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { DeleteIntakeFormHandler } from './delete-intake-form.handler';

describe('DeleteIntakeFormHandler', () => {
  let handler: DeleteIntakeFormHandler;
  let prisma: PrismaService;
  let tx: Record<string, any>;
  let rls: { withTransaction: jest.Mock };

  beforeEach(async () => {
    tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'test' }]),
      intakeForm: { delete: jest.fn().mockResolvedValue(undefined) },
      intakeResponse: { findMany: jest.fn().mockResolvedValue([]) },
      intakeResponseRevision: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
    };
    rls = { withTransaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(tx)) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeleteIntakeFormHandler,
        { provide: PrismaService, useValue: {
    intakeForm: { findFirst: jest.fn(), delete: jest.fn() },
    intakeResponse: { findMany: jest.fn() },
        } },
        { provide: RlsTransactionService, useValue: rls },
      ],
    }).compile();

    handler = module.get<DeleteIntakeFormHandler>(DeleteIntakeFormHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should execute', async () => {
    (prisma.intakeForm.findFirst as jest.Mock).mockResolvedValue({ id: 'test' });
    await handler.execute({ formId: 'test' } as any);
    
    (prisma.intakeForm.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(handler.execute({ formId: 'test' } as any)).rejects.toThrow();
  });

  it('archives all form responses in the same transaction before deleting the form', async () => {
    (prisma.intakeForm.findFirst as jest.Mock).mockResolvedValue({ id: 'test' });
    tx.intakeResponse.findMany.mockResolvedValue([
      {
        id: 'response-current',
        bookingId: 'booking-1',
        formId: 'test',
        clientId: 'client-1',
        answers: { q1: 'current' },
        supersededAt: null,
      },
      {
        id: 'response-old',
        bookingId: 'booking-2',
        formId: 'test',
        clientId: 'client-2',
        answers: { q1: 'old' },
        supersededAt: new Date('2026-01-02T10:00:00Z'),
      },
    ]);

    await handler.execute({ formId: 'test' });

    expect(tx.intakeResponseRevision.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          sourceResponseId: 'response-current',
          bookingId: 'booking-1',
          formId: 'test',
          clientId: 'client-1',
          answers: { q1: 'current' },
          reason: 'AUTHORIZED_DELETE',
        }),
        expect.objectContaining({
          sourceResponseId: 'response-old',
          bookingId: 'booking-2',
          formId: 'test',
          answers: { q1: 'old' },
          reason: 'AUTHORIZED_DELETE',
        }),
      ],
    });
    expect(tx.intakeForm.delete).toHaveBeenCalledWith({ where: { id: 'test' } });
  });

  it('does not delete the form when response archival fails', async () => {
    (prisma.intakeForm.findFirst as jest.Mock).mockResolvedValue({ id: 'test' });
    tx.intakeResponse.findMany.mockResolvedValue([{
      id: 'response-1',
      bookingId: 'booking-1',
      formId: 'test',
      clientId: 'client-1',
      answers: { q1: 'answer' },
      supersededAt: null,
    }]);
    tx.intakeResponseRevision.createMany.mockRejectedValue(new Error('archive unavailable'));

    await expect(handler.execute({ formId: 'test' })).rejects.toThrow('archive unavailable');
    expect(tx.intakeForm.delete).not.toHaveBeenCalled();
    expect(prisma.intakeForm.delete).not.toHaveBeenCalled();
  });

  it('takes the intake form row lock before reading responses for archival', async () => {
    (prisma.intakeForm.findFirst as jest.Mock).mockResolvedValue({ id: 'test' });
    await handler.execute({ formId: 'test' });

    expect(tx.$queryRaw).toHaveBeenCalled();
    expect((tx.$queryRaw.mock.calls[0][0] as string[]).join('')).toMatch(/FOR UPDATE/i);
  });
});
