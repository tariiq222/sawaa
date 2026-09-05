import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService, RlsTransactionService } from '../../../src/infrastructure/database';
import { CreateIntakeFormHandler } from '../../../src/modules/org-experience/intake-forms/create-intake-form.handler';
import { UpdateIntakeFormHandler } from '../../../src/modules/org-experience/intake-forms/update-intake-form.handler';
import { SetIntakeFieldsHandler } from '../../../src/modules/org-experience/intake-forms/set-intake-fields.handler';
import { ListIntakeFormsHandler } from '../../../src/modules/org-experience/intake-forms/list-intake-forms.handler';
import { GetIntakeFormResponsesHandler } from '../../../src/modules/org-experience/intake-forms/get-intake-form-responses.handler';
import { SubmitIntakeResponseHandler } from '../../../src/modules/org-experience/submit-intake-response/submit-intake-response.handler';

const describeReal = process.env.REAL_E2E_DATABASE_URL ? describe : describe.skip;

describeReal('Intake form persistence and locking (real PostgreSQL)', () => {
  let prisma: PrismaService;
  let transaction: RlsTransactionService;
  const formIds: string[] = [];
  const bookingIds: string[] = [];

  beforeAll(async () => {
    const url = new URL(process.env.REAL_E2E_DATABASE_URL!);
    if (!['localhost', '127.0.0.1'].includes(url.hostname) || !/test|e2e/.test(url.pathname) || /prod|stag|dev/.test(url.pathname)) {
      throw new Error('An isolated local test database is required');
    }
    process.env.DATABASE_URL = url.toString();
    prisma = new PrismaService();
    transaction = new RlsTransactionService(prisma);
    await prisma.$connect();
  });

  afterAll(async () => {
    if (!prisma) return;
    // Delete only fixtures created by this suite, never shared seed records.
    await prisma.intakeForm.deleteMany({ where: { id: { in: formIds } } });
    await prisma.booking.deleteMany({ where: { id: { in: bookingIds } } });
    await prisma.$disconnect();
  });

  async function createForm() {
    const form = await new CreateIntakeFormHandler(prisma).execute({
      nameAr: 'اختبار حفظ النموذج', type: 'PRE_SESSION', scope: 'GLOBAL',
      fields: [{ labelAr: 'سؤال', fieldType: 'TEXT', isRequired: true }],
    });
    formIds.push(form.id);
    expect(form.submissionsCount).toBe(0);
    return form;
  }

  async function createBooking() {
    const booking = await prisma.booking.create({ data: {
      branchId: randomUUID(), clientId: randomUUID(), employeeId: randomUUID(),
      deliveryType: 'IN_PERSON', scheduledAt: new Date('2030-01-01T08:00:00Z'),
      endsAt: new Date('2030-01-01T08:30:00Z'), durationMins: 30, price: 0,
      bookingNumber: Math.floor(Math.random() * 1_000_000_000),
    } });
    bookingIds.push(booking.id);
    return booking;
  }

  it('counts real responses and preserves their field IDs through metadata saves and rejected field changes', async () => {
    const form = await createForm();
    const booking = await createBooking();
    const fieldId = form.fields[0].id;
    await new SubmitIntakeResponseHandler(prisma, transaction).execute({
      formId: form.id, bookingId: booking.id, answers: { [fieldId]: 'إجابة' },
    });
    const updated = await new UpdateIntakeFormHandler(prisma, transaction).execute({
      formId: form.id, nameAr: 'اسم معدل', type: 'POST_SESSION',
    });
    expect(updated.submissionsCount).toBe(1);
    expect(updated.fields[0].id).toBe(fieldId);
    const unchanged = await new SetIntakeFieldsHandler(prisma, transaction).execute({
      formId: form.id, fields: [{ labelAr: 'سؤال', labelEn: '', fieldType: 'TEXT', isRequired: true, options: [] }],
    });
    expect(unchanged!.fields[0].id).toBe(fieldId);
    expect(unchanged!.submissionsCount).toBe(1);
    await expect(new UpdateIntakeFormHandler(prisma, transaction).execute({
      formId: form.id, nameAr: 'لا يجب حفظه', fields: [],
    })).rejects.toThrow(ConflictException);
    expect((await prisma.intakeForm.findUniqueOrThrow({ where: { id: form.id } })).nameAr).toBe('اسم معدل');
    const listed = await new ListIntakeFormsHandler(prisma).execute({});
    expect(listed.find((entry) => entry.id === form.id)?.submissionsCount).toBe(1);
    const [response] = await new GetIntakeFormResponsesHandler(prisma).execute({ bookingId: booking.id });
    expect(response.form.submissionsCount).toBe(1);
    expect(response.answers[fieldId]).toBe('إجابة');
  });

  it('rolls back metadata and deleted fields when a replacement cannot be persisted', async () => {
    const form = await createForm();
    await expect(new UpdateIntakeFormHandler(prisma, transaction).execute({
      formId: form.id, nameAr: 'لا يجب حفظه',
      fields: [{ labelAr: 'سؤال جديد', fieldType: 'TEXT', position: 2 ** 31 }],
    })).rejects.toThrow();
    const persisted = await prisma.intakeForm.findUniqueOrThrow({ where: { id: form.id }, include: { fields: true } });
    expect(persisted.nameAr).toBe(form.nameAr);
    expect(persisted.fields.map((field) => field.id)).toEqual([form.fields[0].id]);
  });

  it('waits for a field replacement and revalidates answers against the committed field IDs', async () => {
    const form = await createForm();
    const booking = await createBooking();
    let release!: () => void;
    let ready!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const acquired = new Promise<void>((resolve) => { ready = resolve; });
    const gatedTransaction = new RlsTransactionService(prisma);
    jest.spyOn(gatedTransaction, 'withTransaction').mockImplementation((callback) =>
      prisma.$transaction(async (tx) => {
        const result = await callback(tx);
        ready();
        await gate;
        return result;
      }, { timeout: 10_000 }),
    );
    const replacing = new SetIntakeFieldsHandler(prisma, gatedTransaction).execute({
      formId: form.id, fields: [{ labelAr: 'سؤال جديد', fieldType: 'TEXT' }],
    });
    await acquired;
    const submitting = new SubmitIntakeResponseHandler(prisma, transaction).execute({
      formId: form.id, bookingId: booking.id, answers: { [form.fields[0].id]: 'إجابة قديمة' },
    }).catch((error: unknown) => error);
    try {
      let waiting = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        const rows = await prisma.$queryRaw<{ waiting: boolean }[]>`
          SELECT EXISTS (SELECT 1 FROM pg_stat_activity
            WHERE datname = current_database() AND wait_event_type = 'Lock'
              AND query LIKE 'SELECT id FROM "IntakeForm"%FOR UPDATE%') AS waiting`;
        if (rows[0].waiting) { waiting = true; break; }
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      expect(waiting).toBe(true);
    } finally {
      release();
      const replacement = await replacing;
      expect(replacement!.fields[0].id).not.toBe(form.fields[0].id);
      expect(replacement!.submissionsCount).toBe(0);
    }
    expect(await submitting).toBeInstanceOf(BadRequestException);
    expect(await prisma.intakeResponse.count({ where: { formId: form.id } })).toBe(0);
  });

  it('rejects a waiting replacement after an in-flight answer commits', async () => {
    const form = await createForm();
    const booking = await createBooking();
    let release!: () => void;
    let ready!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const acquired = new Promise<void>((resolve) => { ready = resolve; });
    const gatedTransaction = new RlsTransactionService(prisma);
    jest.spyOn(gatedTransaction, 'withTransaction').mockImplementation((callback) =>
      prisma.$transaction(async (tx) => {
        const result = await callback(tx);
        ready();
        await gate;
        return result;
      }, { timeout: 10_000 }),
    );
    const submitting = new SubmitIntakeResponseHandler(prisma, gatedTransaction).execute({
      formId: form.id, bookingId: booking.id, answers: { [form.fields[0].id]: 'إجابة' },
    });
    await acquired;
    const replacing = new SetIntakeFieldsHandler(prisma, transaction).execute({
      formId: form.id, fields: [{ labelAr: 'سؤال جديد', fieldType: 'TEXT' }],
    }).catch((error: unknown) => error);
    try {
      let waiting = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        const rows = await prisma.$queryRaw<{ waiting: boolean }[]>`
          SELECT EXISTS (SELECT 1 FROM pg_stat_activity
            WHERE datname = current_database() AND wait_event_type = 'Lock'
              AND query LIKE 'SELECT id FROM "IntakeForm"%FOR UPDATE%') AS waiting`;
        if (rows[0].waiting) { waiting = true; break; }
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      expect(waiting).toBe(true);
    } finally {
      release();
      await submitting;
    }
    expect(await replacing).toBeInstanceOf(ConflictException);
    const saved = await prisma.intakeForm.findUniqueOrThrow({ where: { id: form.id }, include: { fields: true } });
    expect(saved.fields[0].id).toBe(form.fields[0].id);
  });
});
