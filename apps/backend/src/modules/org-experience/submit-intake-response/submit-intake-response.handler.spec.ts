import { BadRequestException, NotFoundException } from '@nestjs/common';
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
  existingResponse?: { id: string } | null;
}

const build = (opts: Opts = {}) => {
  const booking = opts.booking === undefined ? { id: 'book-1', clientId: 'client-1' } : opts.booking;
  const form = opts.form === undefined ? baseForm : opts.form;
  const existingResponse = opts.existingResponse ?? null;

  const tx = {
    intakeResponse: {
      findFirst: jest.fn().mockResolvedValue(existingResponse),
      update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: existingResponse?.id, ...data })),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'new-resp', ...data })),
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
  return { handler, prisma, tx };
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

  it('upserts (updates) when a response already exists for (bookingId, formId)', async () => {
    const { handler, tx } = build({ existingResponse: { id: 'existing-1' } });
    await handler.execute({
      bookingId: 'book-1',
      formId: 'form-1',
      answers: { 'f-text': 'محمد' },
      clientId: 'client-1',
    });
    expect(tx.intakeResponse.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'existing-1' } }),
    );
    expect(tx.intakeResponse.create).not.toHaveBeenCalled();
  });

  it('allows staff submit-on-behalf without a clientId (no ownership check)', async () => {
    const { handler, tx } = build();
    await handler.execute({ bookingId: 'book-1', formId: 'form-1', answers: { 'f-text': 'x' } });
    expect(tx.intakeResponse.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ clientId: 'client-1' }) }),
    );
  });
});
