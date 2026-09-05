/**
 * T3 intake history — real Postgres checks.
 *
 * Run with REAL_E2E_DATABASE_URL pointing at the dedicated safe test
 * database after the additive intake history migration is applied.
 */
import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { BookingStatus, DeliveryType, InvoiceStatus, PaymentMethod, Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../../../src/infrastructure/database';
import { DeleteBookingHandler } from '../../../src/modules/bookings/delete-booking/delete-booking.handler';
import { DeleteIntakeFormHandler } from '../../../src/modules/org-experience/intake-forms/delete-intake-form.handler';
import { GetIntakeFormResponsesHandler } from '../../../src/modules/org-experience/intake-forms/get-intake-form-responses.handler';
import { SubmitIntakeResponseHandler } from '../../../src/modules/org-experience/submit-intake-response/submit-intake-response.handler';
import { ProcessPaymentHandler } from '../../../src/modules/finance/process-payment/process-payment.handler';
import { applyLegacyImportPlan } from '../../../src/modules/ops/legacy-import/legacy-import.writer';
import { createRealE2eApp } from '../../helpers/create-real-e2e-app';

const describeRealE2e = process.env.REAL_E2E_DATABASE_URL ? describe : describe.skip;

describeRealE2e('T3 intake current response (real e2e)', () => {
  jest.setTimeout(60_000);

  let app: INestApplication;
  let prisma: PrismaService;
  let prismaA: PrismaClient;
  let prismaB: PrismaClient;
  let finance: PrismaClient;
  let observer: PrismaClient;
  let rlsA: { withTransaction: <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) => Promise<T> };
  let rlsB: { withTransaction: <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) => Promise<T> };

  const appDatabaseUrl = (name: string) => {
    const url = new URL(process.env.REAL_E2E_DATABASE_URL!);
    url.searchParams.set('application_name', name);
    return url.toString();
  };

  const createClient = (name: string) => new PrismaClient({
    adapter: new PrismaPg({ connectionString: appDatabaseUrl(name) }),
  });

  const createFixture = async (label: string) => {
    const bookingId = randomUUID();
    const formId = randomUUID();
    const fieldId = randomUUID();
    const suffix = `${label}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
    await prisma.intakeForm.create({
      data: { id: formId, nameAr: `اختبار ${suffix}`, type: 'PRE_SESSION', scope: 'GLOBAL' },
    });
    await prisma.intakeField.create({
      data: {
        id: fieldId,
        formId,
        labelAr: 'الإجابة',
        fieldType: 'TEXT',
        isRequired: true,
        position: 0,
      },
    });
    await prisma.booking.create({
      data: {
        id: bookingId,
        branchId: randomUUID(),
        clientId: randomUUID(),
        employeeId: randomUUID(),
        serviceId: randomUUID(),
        bookingType: 'INDIVIDUAL',
        deliveryType: DeliveryType.IN_PERSON,
        status: BookingStatus.EXPIRED,
        scheduledAt: new Date(Date.now() + 86_400_000),
        endsAt: new Date(Date.now() + 90_000_000),
        durationMins: 60,
        price: 0,
        bookingNumber: 1_000_000_000 + Math.floor(Math.random() * 1_000_000_000),
      },
    });
    return { bookingId, formId, fieldId };
  };

  const createFinanceFixture = async (label: string) => {
    const fixture = await createFixture(label);
    await prisma.booking.update({
      where: { id: fixture.bookingId },
      data: { status: BookingStatus.COMPLETED },
    });
    const invoice = await prisma.invoice.create({
      data: {
        branchId: randomUUID(),
        clientId: randomUUID(),
        employeeId: randomUUID(),
        bookingId: fixture.bookingId,
        subtotal: 100,
        discountAmt: 0,
        vatRate: 0,
        vatAmt: 0,
        total: 100,
        status: InvoiceStatus.ISSUED,
      },
    });
    return { ...fixture, invoiceId: invoice.id };
  };

  const cleanupFixture = async (fixture: { bookingId: string; formId: string }) => {
    await prisma.intakeResponseRevision.deleteMany({ where: { bookingId: fixture.bookingId } });
    await prisma.intakeResponse.deleteMany({ where: { bookingId: fixture.bookingId } });
    await prisma.booking.deleteMany({ where: { id: fixture.bookingId } });
    await prisma.intakeForm.deleteMany({ where: { id: fixture.formId } });
  };

  const cleanupFinanceFixture = async (fixture: { bookingId: string; formId: string; invoiceId: string }) => {
    await prisma.payment.deleteMany({ where: { invoiceId: fixture.invoiceId } });
    await prisma.invoice.deleteMany({ where: { id: fixture.invoiceId } });
    await cleanupFixture(fixture);
  };

  const submitHandler = (client: PrismaClient) => new SubmitIntakeResponseHandler(
    client as never,
    {
      withTransaction: <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) => client.$transaction(fn),
    } as never,
  );

  const deleteBookingHandler = (client: PrismaClient, rls: typeof rlsA) =>
    new DeleteBookingHandler(client as never, rls as never);

  const deleteFormHandler = (client: PrismaClient, rls: typeof rlsA) =>
    new DeleteIntakeFormHandler(client as never, rls as never);

  const processPaymentHandler = (client: PrismaClient) => new ProcessPaymentHandler(
    client as never,
    {
      withTransaction: <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) => client.$transaction(fn),
    } as never,
    { publish: jest.fn().mockResolvedValue(undefined) } as never,
  );

  const holdAfterQuery = (
    client: PrismaClient,
    queryNumber: number,
    onLocked: () => void,
    release: Promise<void>,
  ) => ({
    withTransaction: <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) => client.$transaction(async (rawTx) => {
      let queryCount = 0;
      const tx = new Proxy(rawTx, {
        get(target, property, receiver) {
          if (property !== '$queryRaw') return Reflect.get(target, property, receiver);
          return async (...args: unknown[]) => {
            const queryRaw = Reflect.get(target, property, receiver) as (...queryArgs: unknown[]) => Promise<unknown>;
            const result = await queryRaw.apply(target, args);
            queryCount += 1;
            if (queryCount === queryNumber) {
              onLocked();
              await release;
            }
            return result;
          };
        },
      });
      return fn(tx as Prisma.TransactionClient);
    }),
  });

  const waitForLockWaits = async (applicationNames: string[]) => {
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      const rows = await observer.$queryRaw<Array<{ application_name: string }>>`
        SELECT application_name
        FROM pg_stat_activity
        WHERE application_name IN (${Prisma.join(applicationNames)})
          AND wait_event_type = 'Lock'
      `;
      if (new Set(rows.map((row) => row.application_name)).size >= applicationNames.length) return;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error(`Expected lock waits for ${applicationNames.join(', ')}`);
  };

  const holdIntakePairLock = async (bookingId: string, formId: string) => {
    let readyResolve!: () => void;
    let releaseResolve!: () => void;
    const ready = new Promise<void>((resolve) => { readyResolve = resolve; });
    const release = new Promise<void>((resolve) => { releaseResolve = resolve; });
    const key = `intake:${bookingId}:${formId}`;
    const transaction = prismaB.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
      readyResolve();
      await release;
    });
    await ready;
    return { transaction, release: releaseResolve };
  };

  beforeAll(async () => {
    const result = await createRealE2eApp();
    app = result.app;
    prisma = result.prisma;
    prismaA = createClient('t3-submit-a');
    prismaB = createClient('t3-submit-b');
    finance = createClient('t3-finance-b');
    observer = createClient('t3-observer');
    rlsA = { withTransaction: <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) => prismaA.$transaction(fn) };
    rlsB = { withTransaction: <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) => prismaB.$transaction(fn) };
  });

  afterAll(async () => {
    await app?.close();
    await Promise.all([prismaA?.$disconnect(), prismaB?.$disconnect(), finance?.$disconnect(), observer?.$disconnect()]);
  });

  it('serializes concurrent different submissions and preserves the previous answer', async () => {
    const fixture = await createFixture('different');
    try {
      const holder = await holdIntakePairLock(fixture.bookingId, fixture.formId);
      const a = submitHandler(prismaA).execute({
        bookingId: fixture.bookingId, formId: fixture.formId, answers: { [fixture.fieldId]: 'الأول' },
      });
      const b = submitHandler(prismaB).execute({
        bookingId: fixture.bookingId, formId: fixture.formId, answers: { [fixture.fieldId]: 'الثاني' },
      });
      await waitForLockWaits(['t3-submit-a', 't3-submit-b']);
      holder.release();
      await expect(Promise.all([a, b])).resolves.toHaveLength(2);
      await holder.transaction;

      const current = await prisma.intakeResponse.findMany({ where: { bookingId: fixture.bookingId, supersededAt: null } });
      const revisions = await prisma.intakeResponseRevision.findMany({ where: { bookingId: fixture.bookingId } });
      expect(current).toHaveLength(1);
      expect(revisions).toHaveLength(1);
      expect(['الأول', 'الثاني']).toContain((current[0]!.answers as Record<string, string>)[fixture.fieldId]);
      expect(['الأول', 'الثاني']).toContain((revisions[0]!.answers as Record<string, string>)[fixture.fieldId]);
      expect((current[0]!.answers as Record<string, string>)[fixture.fieldId]).not.toBe(
        (revisions[0]!.answers as Record<string, string>)[fixture.fieldId],
      );
    } finally {
      await cleanupFixture(fixture);
    }
  });

  it('serializes concurrent identical submissions as one current row with no revision', async () => {
    const fixture = await createFixture('identical');
    try {
      const holder = await holdIntakePairLock(fixture.bookingId, fixture.formId);
      const answers = { [fixture.fieldId]: 'نفس الإجابة' };
      const a = submitHandler(prismaA).execute({ bookingId: fixture.bookingId, formId: fixture.formId, answers });
      const b = submitHandler(prismaB).execute({ bookingId: fixture.bookingId, formId: fixture.formId, answers });
      await waitForLockWaits(['t3-submit-a', 't3-submit-b']);
      holder.release();
      await expect(Promise.all([a, b])).resolves.toHaveLength(2);
      await holder.transaction;
      expect(await prisma.intakeResponse.count({ where: { bookingId: fixture.bookingId, supersededAt: null } })).toBe(1);
      expect(await prisma.intakeResponseRevision.count({ where: { bookingId: fixture.bookingId } })).toBe(0);
    } finally {
      await cleanupFixture(fixture);
    }
  });

  it('returns 409 for duplicate current legacy rows and leaves both rows unchanged', async () => {
    const fixture = await createFixture('duplicate');
    try {
      await prisma.intakeResponse.createMany({ data: [
        { bookingId: fixture.bookingId, formId: fixture.formId, answers: { [fixture.fieldId]: 'قديم 1' } },
        { bookingId: fixture.bookingId, formId: fixture.formId, answers: { [fixture.fieldId]: 'قديم 2' } },
      ] });
      const before = await prisma.intakeResponse.findMany({ where: { bookingId: fixture.bookingId }, orderBy: { id: 'asc' } });
      await expect(submitHandler(prismaA).execute({
        bookingId: fixture.bookingId, formId: fixture.formId, answers: { [fixture.fieldId]: 'جديد' },
      })).rejects.toMatchObject({ status: 409 });
      const after = await prisma.intakeResponse.findMany({ where: { bookingId: fixture.bookingId }, orderBy: { id: 'asc' } });
      expect(after.map((row) => row.answers)).toEqual(before.map((row) => row.answers));
    } finally {
      await cleanupFixture(fixture);
    }
  });

  it('returns only current responses, current counts, and a public projection', async () => {
    const fixture = await createFixture('reader');
    try {
      await prisma.intakeResponse.create({ data: {
        bookingId: fixture.bookingId, formId: fixture.formId, clientId: 'client-1', answers: { [fixture.fieldId]: 'current' },
      } });
      const old = await prisma.intakeResponse.create({ data: {
        bookingId: fixture.bookingId, formId: fixture.formId, clientId: 'client-1', answers: { [fixture.fieldId]: 'old' },
      } });
      await prisma.intakeResponse.update({ where: { id: old.id }, data: { supersededAt: new Date(), supersededById: old.id } });

      const result = await new GetIntakeFormResponsesHandler(prisma as never).execute({ bookingId: fixture.bookingId });
      expect(result).toHaveLength(1);
      expect(result[0]).not.toHaveProperty('supersededAt');
      expect(result[0]).not.toHaveProperty('supersededById');
      expect(result[0]!.form.submissionsCount).toBe(1);
    } finally {
      await cleanupFixture(fixture);
    }
  });

  it('archives responses when deleting a booking and preserves revisions after deletion', async () => {
    const fixture = await createFixture('delete-booking');
    try {
      await prisma.intakeResponse.createMany({ data: [
        { bookingId: fixture.bookingId, formId: fixture.formId, answers: { [fixture.fieldId]: 'current' } },
        { bookingId: fixture.bookingId, formId: fixture.formId, answers: { [fixture.fieldId]: 'old' }, supersededAt: new Date() },
      ] });
      await deleteBookingHandler(prismaA, rlsA).execute({ bookingId: fixture.bookingId, changedBy: randomUUID() });
      expect(await prisma.booking.findUnique({ where: { id: fixture.bookingId } })).toBeNull();
      expect(await prisma.intakeResponse.count({ where: { bookingId: fixture.bookingId } })).toBe(0);
      expect(await prisma.intakeResponseRevision.count({ where: { bookingId: fixture.bookingId } })).toBe(2);
    } finally {
      await cleanupFixture(fixture);
    }
  });

  it('archives responses when deleting a form and preserves revisions after cascading response deletion', async () => {
    const fixture = await createFixture('delete-form');
    try {
      await prisma.intakeResponse.create({ data: {
        bookingId: fixture.bookingId, formId: fixture.formId, answers: { [fixture.fieldId]: 'answer' },
      } });
      await deleteFormHandler(prismaA, rlsA).execute({ formId: fixture.formId });
      expect(await prisma.intakeForm.findUnique({ where: { id: fixture.formId } })).toBeNull();
      expect(await prisma.intakeResponse.count({ where: { formId: fixture.formId } })).toBe(0);
      expect(await prisma.intakeResponseRevision.count({ where: { formId: fixture.formId } })).toBe(1);
    } finally {
      await cleanupFixture(fixture);
    }
  });

  it('rolls back booking deletion when injected intake archival fails', async () => {
    const fixture = await createFixture('archive-failure');
    try {
      await prisma.intakeResponse.create({ data: {
        bookingId: fixture.bookingId, formId: fixture.formId, answers: { [fixture.fieldId]: 'answer' },
      } });
      const failingRls = {
        withTransaction: <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) => prismaA.$transaction(async (tx) => {
          const guardedTx = new Proxy(tx, {
            get(target, property, receiver) {
              if (property === 'intakeResponseRevision') {
                return { createMany: async () => { throw new Error('injected archival failure'); } };
              }
              return Reflect.get(target, property, receiver);
            },
          });
          return fn(guardedTx as Prisma.TransactionClient);
        }),
      };
      await expect(deleteBookingHandler(prismaA, failingRls).execute({
        bookingId: fixture.bookingId, changedBy: randomUUID(),
      })).rejects.toThrow('injected archival failure');
      expect(await prisma.booking.findUnique({ where: { id: fixture.bookingId } })).not.toBeNull();
      expect(await prisma.intakeResponse.count({ where: { bookingId: fixture.bookingId } })).toBe(1);
      expect(await prisma.intakeResponseRevision.count({ where: { bookingId: fixture.bookingId } })).toBe(0);
    } finally {
      await cleanupFixture(fixture);
    }
  });

  it('rechecks terminal status after a deterministic lock wait before deleting a revived booking', async () => {
    const fixture = await createFixture('revived');
    try {
      let readyResolve!: () => void;
      let releaseResolve!: () => void;
      const ready = new Promise<void>((resolve) => { readyResolve = resolve; });
      const release = new Promise<void>((resolve) => { releaseResolve = resolve; });
      const holder = prismaB.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "Booking" WHERE "id" = ${fixture.bookingId} FOR UPDATE`;
        await tx.booking.update({ where: { id: fixture.bookingId }, data: { status: BookingStatus.CONFIRMED } });
        readyResolve();
        await release;
      });
      await ready;
      const deletion = deleteBookingHandler(prismaA, rlsA).execute({ bookingId: fixture.bookingId, changedBy: randomUUID() });
      await waitForLockWaits(['t3-submit-a']);
      releaseResolve();
      await holder;
      await expect(deletion).rejects.toMatchObject({ status: 400 });
      expect((await prisma.booking.findUnique({ where: { id: fixture.bookingId } }))?.status).toBe(BookingStatus.CONFIRMED);
    } finally {
      await cleanupFixture(fixture);
    }
  });

  it('serializes overlapping submit and booking delete in both winner orders', async () => {
    const submitWinner = await createFixture('overlap-booking-submit-wins');
    const deleteWinner = await createFixture('overlap-booking-delete-wins');
    try {
      let submitReady!: () => void;
      let submitRelease!: () => void;
      const submitReleased = new Promise<void>((resolve) => { submitRelease = resolve; });
      const submitHoldingRls = holdAfterQuery(prismaB, 1, () => submitReady(), submitReleased);
      const submitReadyPromise = new Promise<void>((resolve) => { submitReady = resolve; });
      const submit = new SubmitIntakeResponseHandler(prismaB as never, submitHoldingRls as never).execute({
        bookingId: submitWinner.bookingId,
        formId: submitWinner.formId,
        answers: { [submitWinner.fieldId]: 'submit-wins' },
      });
      await submitReadyPromise;
      const deleteAfterSubmit = deleteBookingHandler(prismaA, rlsA).execute({ bookingId: submitWinner.bookingId, changedBy: randomUUID() });
      await waitForLockWaits(['t3-submit-a']);
      submitRelease();
      await expect(Promise.all([submit, deleteAfterSubmit])).resolves.toHaveLength(2);
      expect(await prisma.intakeResponse.count({ where: { bookingId: submitWinner.bookingId } })).toBe(0);
      expect(await prisma.intakeResponseRevision.count({ where: { bookingId: submitWinner.bookingId, reason: 'AUTHORIZED_DELETE' } })).toBe(1);

      let deleteReady!: () => void;
      let deleteRelease!: () => void;
      const deleteReleased = new Promise<void>((resolve) => { deleteRelease = resolve; });
      const deleteHoldingRls = holdAfterQuery(prismaA, 1, () => deleteReady(), deleteReleased);
      const deleteReadyPromise = new Promise<void>((resolve) => { deleteReady = resolve; });
      const deleteBookingPromise = deleteBookingHandler(prismaA, deleteHoldingRls as never).execute({ bookingId: deleteWinner.bookingId, changedBy: randomUUID() });
      await deleteReadyPromise;
      const submitAfterDelete = submitHandler(prismaB).execute({
        bookingId: deleteWinner.bookingId,
        formId: deleteWinner.formId,
        answers: { [deleteWinner.fieldId]: 'submit-loses' },
      });
      await waitForLockWaits(['t3-submit-b']);
      deleteRelease();
      await deleteBookingPromise;
      await expect(submitAfterDelete).rejects.toMatchObject({ status: 404 });
      expect(await prisma.intakeResponse.count({ where: { bookingId: deleteWinner.bookingId } })).toBe(0);
      expect(await prisma.intakeResponseRevision.count({ where: { bookingId: deleteWinner.bookingId } })).toBe(0);
    } finally {
      await cleanupFixture(submitWinner);
      await cleanupFixture(deleteWinner);
    }
  });

  it('serializes overlapping submit and form delete in both winner orders', async () => {
    const submitWinner = await createFixture('overlap-form-submit-wins');
    const deleteWinner = await createFixture('overlap-form-delete-wins');
    try {
      let submitReady!: () => void;
      let submitRelease!: () => void;
      const submitReleased = new Promise<void>((resolve) => { submitRelease = resolve; });
      const submitHoldingRls = holdAfterQuery(prismaB, 2, () => submitReady(), submitReleased);
      const submitReadyPromise = new Promise<void>((resolve) => { submitReady = resolve; });
      const submit = new SubmitIntakeResponseHandler(prismaB as never, submitHoldingRls as never).execute({
        bookingId: submitWinner.bookingId,
        formId: submitWinner.formId,
        answers: { [submitWinner.fieldId]: 'submit-wins' },
      });
      await submitReadyPromise;
      const deleteAfterSubmit = deleteFormHandler(prismaA, rlsA).execute({ formId: submitWinner.formId });
      await waitForLockWaits(['t3-submit-a']);
      submitRelease();
      await expect(Promise.all([submit, deleteAfterSubmit])).resolves.toHaveLength(2);
      expect(await prisma.intakeResponse.count({ where: { formId: submitWinner.formId } })).toBe(0);
      expect(await prisma.intakeResponseRevision.count({ where: { formId: submitWinner.formId, reason: 'AUTHORIZED_DELETE' } })).toBe(1);

      let deleteReady!: () => void;
      let deleteRelease!: () => void;
      const deleteReleased = new Promise<void>((resolve) => { deleteRelease = resolve; });
      const deleteHoldingRls = holdAfterQuery(prismaA, 1, () => deleteReady(), deleteReleased);
      const deleteReadyPromise = new Promise<void>((resolve) => { deleteReady = resolve; });
      const deleteFormPromise = deleteFormHandler(prismaA, deleteHoldingRls as never).execute({ formId: deleteWinner.formId });
      await deleteReadyPromise;
      const submitAfterDelete = submitHandler(prismaB).execute({
        bookingId: deleteWinner.bookingId,
        formId: deleteWinner.formId,
        answers: { [deleteWinner.fieldId]: 'submit-loses' },
      });
      await waitForLockWaits(['t3-submit-b']);
      deleteRelease();
      await deleteFormPromise;
      await expect(submitAfterDelete).rejects.toMatchObject({ status: 404 });
      expect(await prisma.intakeResponse.count({ where: { formId: deleteWinner.formId } })).toBe(0);
      expect(await prisma.intakeResponseRevision.count({ where: { formId: deleteWinner.formId } })).toBe(0);
    } finally {
      await cleanupFixture(submitWinner);
      await cleanupFixture(deleteWinner);
    }
  });

  it('serializes an actual process-payment writer and booking delete in both winner orders', async () => {
    const financeWinner = await createFinanceFixture('overlap-finance-wins');
    const deleteWinner = await createFinanceFixture('overlap-delete-wins');
    try {
      let deleteReady!: () => void;
      let deleteRelease!: () => void;
      const deleteReleased = new Promise<void>((resolve) => { deleteRelease = resolve; });
      const deleteHoldingRls = holdAfterQuery(prismaA, 1, () => deleteReady(), deleteReleased);
      const deleteReadyPromise = new Promise<void>((resolve) => { deleteReady = resolve; });
      const deleteAfterFinance = deleteBookingHandler(prismaA, deleteHoldingRls as never).execute({
        bookingId: financeWinner.bookingId,
        changedBy: randomUUID(),
      });
      await deleteReadyPromise;
      const financePayment = processPaymentHandler(finance).execute({
        invoiceId: financeWinner.invoiceId,
        amount: 100,
        method: PaymentMethod.CASH,
        idempotencyKey: randomUUID(),
      });
      await expect(financePayment).resolves.toMatchObject({ invoiceId: financeWinner.invoiceId });
      deleteRelease();
      await expect(deleteAfterFinance).rejects.toMatchObject({ status: 400 });
      expect(await prisma.booking.findUnique({ where: { id: financeWinner.bookingId } })).not.toBeNull();
      expect(await prisma.payment.count({ where: { invoiceId: financeWinner.invoiceId, status: 'COMPLETED' } })).toBe(1);

      let deleteInvoiceReady!: () => void;
      let deleteInvoiceRelease!: () => void;
      const deleteInvoiceReleased = new Promise<void>((resolve) => { deleteInvoiceRelease = resolve; });
      const deleteInvoiceHoldingRls = holdAfterQuery(prismaA, 2, () => deleteInvoiceReady(), deleteInvoiceReleased);
      const deleteInvoiceReadyPromise = new Promise<void>((resolve) => { deleteInvoiceReady = resolve; });
      const deleteBeforeFinance = deleteBookingHandler(prismaA, deleteInvoiceHoldingRls as never).execute({
        bookingId: deleteWinner.bookingId,
        changedBy: randomUUID(),
      });
      await deleteInvoiceReadyPromise;
      const financeAfterDelete = processPaymentHandler(finance).execute({
        invoiceId: deleteWinner.invoiceId,
        amount: 100,
        method: PaymentMethod.CASH,
        idempotencyKey: randomUUID(),
      });
      await waitForLockWaits(['t3-finance-b']);
      deleteInvoiceRelease();
      await deleteBeforeFinance;
      await expect(financeAfterDelete).rejects.toMatchObject({ status: 404 });
      expect(await prisma.booking.findUnique({ where: { id: deleteWinner.bookingId } })).toBeNull();
      expect(await prisma.payment.count({ where: { invoiceId: deleteWinner.invoiceId } })).toBe(0);
    } finally {
      await cleanupFinanceFixture(financeWinner);
      await cleanupFinanceFixture(deleteWinner);
    }
  });

  it('keeps the existing financial deletion blocker', async () => {
    const fixture = await createFixture('payment-blocker');
    let invoiceId: string | undefined;
    try {
      const invoice = await prisma.invoice.create({ data: {
        branchId: randomUUID(), clientId: randomUUID(), employeeId: randomUUID(), bookingId: fixture.bookingId,
        subtotal: 100, discountAmt: 0, vatRate: 0, vatAmt: 0, total: 100, status: 'PAID',
      } });
      invoiceId = invoice.id;
      await prisma.payment.create({ data: {
        invoiceId, amount: 100, method: 'CASH', status: 'COMPLETED', currency: 'SAR',
      } });
      await expect(deleteBookingHandler(prismaA, rlsA).execute({ bookingId: fixture.bookingId, changedBy: randomUUID() })).rejects.toMatchObject({ status: 400 });
      expect(await prisma.booking.findUnique({ where: { id: fixture.bookingId } })).not.toBeNull();
    } finally {
      if (invoiceId) {
        await prisma.payment.deleteMany({ where: { invoiceId } });
        await prisma.invoice.delete({ where: { id: invoiceId } });
      }
      await cleanupFixture(fixture);
    }
  });

  it('disables legacy import apply after intake history expansion without writing', async () => {
    const before = await prisma.legacyImportRecord.count();

    await expect(
      applyLegacyImportPlan(prisma as never, {} as never, {} as never),
    ).rejects.toThrow('Legacy import apply is disabled after intake history expansion');

    expect(await prisma.legacyImportRecord.count()).toBe(before);
  });
});
