import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { SubmitIntakeResponseHandler } from './submit-intake-response.handler';

const baseForm = {
  id: 'form-1',
  isActive: true,
  fields: [
    { id: 'f-text', labelAr: 'الاسم', fieldType: 'TEXT', isRequired: true, options: null },
    { id: 'f-select', labelAr: 'النوع', fieldType: 'SELECT', isRequired: false, options: ['ذكر', 'أنثى'] },
    { id: 'f-check', labelAr: 'الاهتمامات', fieldType: 'CHECKBOX', isRequired: false, options: ['أ', 'ب', 'ج'] },
  ],
};

interface Opts {
  booking?: { id: string; clientId: string } | null;
  form?: typeof baseForm | null;
  existingResponse?: {
    id: string;
    bookingId?: string;
    formId?: string;
    clientId?: string | null;
    answers?: Record<string, string | string[]>;
  } | null;
  currentResponses?: Array<{ id: string; answers: Record<string, string | string[]> }>;
}

const build = (opts: Opts = {}) => {
  const booking = opts.booking === undefined ? { id: 'book-1', clientId: 'client-1' } : opts.booking;
  const form = opts.form === undefined ? baseForm : opts.form;
  const existingResponse = opts.existingResponse ?? null;
  const currentResponses = opts.currentResponses ?? (existingResponse ? [existingResponse] : []);
  const callOrder: string[] = [];

  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([{ id: 'book-1' }]),
    $executeRaw: jest.fn().mockImplementation(async () => {
      callOrder.push('advisory-lock');
      return 1;
    }),
    booking: {
      findUnique: jest.fn().mockImplementation(async () => booking),
    },
    intakeForm: {
      findUnique: jest.fn().mockImplementation(async () => form),
    },
    intakeResponse: {
      findFirst: jest.fn().mockResolvedValue(existingResponse),
      findMany: jest.fn().mockResolvedValue(currentResponses),
      update: jest.fn().mockImplementation(({ data }) => {
        callOrder.push('update');
        return Promise.resolve({ id: existingResponse?.id, ...data });
      }),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'new-resp', ...data })),
    },
    intakeResponseRevision: {
      create: jest.fn().mockImplementation(async () => {
        callOrder.push('revision');
        return { id: 'revision-1' };
      }),
    },
  };

  const prisma = {
    booking: { findUnique: jest.fn().mockResolvedValue(booking) },
    intakeForm: { findUnique: jest.fn().mockResolvedValue(form) },
  };

  const rlsTransaction = {
    withTransaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(tx)),
  };

  const handler = new SubmitIntakeResponseHandler(prisma as never, rlsTransaction as never);
  return { handler, prisma, tx, callOrder };
};

describe('SubmitIntakeResponseHandler', () => {
  it('rejects when the booking does not exist', async () => {
    const { handler } = build({ booking: null });
    await expect(
      handler.execute({ bookingId: 'book-x', formId: 'form-1', answers: { 'f-text': 'a' }, clientId: 'client-1' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects when the booking belongs to a different client', async () => {
    const { handler } = build();
    await expect(
      handler.execute({ bookingId: 'book-1', formId: 'form-1', answers: { 'f-text': 'a' }, clientId: 'other-client' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects when the form is inactive', async () => {
    const { handler } = build({ form: { ...baseForm, isActive: false } });
    await expect(
      handler.execute({ bookingId: 'book-1', formId: 'form-1', answers: { 'f-text': 'a' }, clientId: 'client-1' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects when a required field is missing', async () => {
    const { handler } = build();
    await expect(
      handler.execute({ bookingId: 'book-1', formId: 'form-1', answers: {}, clientId: 'client-1' }),
    ).rejects.toThrow(/required/i);
  });

  it('rejects an answer referencing an unknown field', async () => {
    const { handler } = build();
    await expect(
      handler.execute({ bookingId: 'book-1', formId: 'form-1', answers: { 'f-text': 'a', 'ghost': 'x' }, clientId: 'client-1' }),
    ).rejects.toThrow(/unknown field/i);
  });

  it('rejects an out-of-range option for a SELECT field', async () => {
    const { handler } = build();
    await expect(
      handler.execute({ bookingId: 'book-1', formId: 'form-1', answers: { 'f-text': 'a', 'f-select': 'مجهول' }, clientId: 'client-1' }),
    ).rejects.toThrow(/invalid option/i);
  });

  it('rejects an invalid CHECKBOX option', async () => {
    const { handler } = build();
    await expect(
      handler.execute({ bookingId: 'book-1', formId: 'form-1', answers: { 'f-text': 'a', 'f-check': ['أ', 'مجهول'] }, clientId: 'client-1' }),
    ).rejects.toThrow(/invalid option/i);
  });

  it('accepts a valid submission and derives clientId from the booking', async () => {
    const { handler, tx } = build();
    const result = await handler.execute({
      bookingId: 'book-1',
      formId: 'form-1',
      answers: { 'f-text': 'سارة', 'f-select': 'أنثى', 'f-check': ['أ', 'ج'] },
      clientId: 'client-1',
    });
    expect(tx.intakeResponse.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ bookingId: 'book-1', formId: 'form-1', clientId: 'client-1' }) }),
    );
    expect(result.clientId).toBe('client-1');
  });

  it('serializes a submission with the booking/form advisory lock before reading current rows', async () => {
    const { handler, tx } = build();
    await handler.execute({
      bookingId: 'book-1',
      formId: 'form-1',
      answers: { 'f-text': 'محمد' },
      clientId: 'client-1',
    });

    expect(tx.$executeRaw).toHaveBeenCalled();
    expect((tx.$executeRaw.mock.calls[0][0] as string[]).join('')).toMatch(/pg_advisory_xact_lock/);
    expect(tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(tx.intakeResponse.findMany.mock.invocationCallOrder[0]);
  });

  it('rechecks booking ownership and form validity inside the locked transaction', async () => {
    const { handler, tx } = build();
    tx.booking.findUnique.mockResolvedValue({ id: 'book-1', clientId: 'other-client' });

    await expect(handler.execute({
      bookingId: 'book-1',
      formId: 'form-1',
      answers: { 'f-text': 'محمد' },
      clientId: 'client-1',
    })).rejects.toThrow(NotFoundException);

    expect(tx.$executeRaw).toHaveBeenCalled();
    expect(tx.booking.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'book-1' } }));
    expect(tx.intakeForm.findUnique).not.toHaveBeenCalled();
  });

  it('returns conflict without choosing when more than one current row exists', async () => {
    const { handler, tx } = build({
      currentResponses: [
        { id: 'current-1', answers: { 'f-text': 'الأول' } },
        { id: 'current-2', answers: { 'f-text': 'الثاني' } },
      ],
    });

    await expect(handler.execute({
      bookingId: 'book-1',
      formId: 'form-1',
      answers: { 'f-text': 'محمد' },
      clientId: 'client-1',
    })).rejects.toThrow(ConflictException);
    expect(tx.intakeResponse.update).not.toHaveBeenCalled();
    expect(tx.intakeResponse.create).not.toHaveBeenCalled();
  });

  it('snapshots changed answers before updating the same current row', async () => {
    const { handler, tx, callOrder } = build({
      existingResponse: {
        id: 'existing-1',
        bookingId: 'book-1',
        formId: 'form-1',
        clientId: 'client-1',
        answers: { 'f-text': 'القديم' },
      },
    });
    await handler.execute({
      bookingId: 'book-1',
      formId: 'form-1',
      answers: { 'f-text': 'محمد' },
      clientId: 'client-1',
    });
    expect(tx.intakeResponseRevision.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sourceResponseId: 'existing-1',
        bookingId: 'book-1',
        formId: 'form-1',
        clientId: 'client-1',
        answers: { 'f-text': 'القديم' },
        reason: 'UPDATE',
      }),
    });
    expect(tx.intakeResponse.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'existing-1' } }),
    );
    expect(callOrder).toEqual(['advisory-lock', 'revision', 'update']);
    expect(tx.intakeResponse.create).not.toHaveBeenCalled();
  });

  it('treats an identical submission as a no-op without creating a revision', async () => {
    const existingAnswers = { 'f-text': 'ثابت', 'f-select': 'ذكر' };
    const answers = { 'f-select': 'ذكر', 'f-text': 'ثابت' };
    const { handler, tx } = build({ existingResponse: {
      id: 'existing-1', bookingId: 'book-1', formId: 'form-1', clientId: 'client-1', answers: existingAnswers,
    } });
    await handler.execute({ bookingId: 'book-1', formId: 'form-1', answers, clientId: 'client-1' });

    expect(tx.intakeResponseRevision.create).not.toHaveBeenCalled();
    expect(tx.intakeResponse.update).not.toHaveBeenCalled();
  });

  it('treats a changed array order as a real answer change', async () => {
    const { handler, tx } = build({ existingResponse: {
      id: 'existing-1',
      bookingId: 'book-1',
      formId: 'form-1',
      clientId: 'client-1',
      answers: { 'f-text': 'ثابت', 'f-check': ['أ', 'ب'] },
    } });

    await handler.execute({
      bookingId: 'book-1',
      formId: 'form-1',
      answers: { 'f-text': 'ثابت', 'f-check': ['ب', 'أ'] },
      clientId: 'client-1',
    });

    expect(tx.intakeResponseRevision.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ reason: 'UPDATE', sourceResponseId: 'existing-1' }),
    }));
    expect(tx.intakeResponse.update).toHaveBeenCalled();
  });

  it('allows staff submit-on-behalf without a clientId (no ownership check)', async () => {
    const { handler, tx } = build();
    await handler.execute({ bookingId: 'book-1', formId: 'form-1', answers: { 'f-text': 'x' } });
    expect(tx.intakeResponse.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ clientId: 'client-1' }) }),
    );
  });
});
