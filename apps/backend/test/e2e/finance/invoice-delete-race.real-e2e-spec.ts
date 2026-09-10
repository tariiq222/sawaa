/**
 * T3 finance/delete lock-order regression checks against real PostgreSQL.
 *
 * Run only with REAL_E2E_DATABASE_URL pointing at a migrated test database.
 * Provider APIs are not involved; payment-first writers are represented by
 * their database lock sequence.
 */
import { randomInt, randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  BookingStatus,
  DeliveryType,
  InvoiceStatus,
  PaymentMethod,
  Prisma,
  PrismaClient,
} from '@prisma/client';
import { DeleteBookingHandler } from '../../../src/modules/bookings/delete-booking/delete-booking.handler';
import { CreateInvoiceHandler } from '../../../src/modules/finance/create-invoice/create-invoice.handler';
import { ProcessPaymentHandler } from '../../../src/modules/finance/process-payment/process-payment.handler';
import { getRealE2eDatabaseUrl } from '../../helpers/create-real-e2e-app';

const describeRealE2e = process.env.REAL_E2E_DATABASE_URL ? describe : describe.skip;

type TransactionPort = {
  withTransaction: <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) => Promise<T>;
};

type Settled<T> =
  | { status: 'fulfilled'; value: T }
  | { status: 'rejected'; reason: unknown };

describeRealE2e('T3 Invoice and booking-delete concurrency (real e2e)', () => {
  jest.setTimeout(60_000);

  let fixtureClient: PrismaClient;
  let deleteClient: PrismaClient;
  let financeClient: PrismaClient;
  let writerClient: PrismaClient;
  let observer: PrismaClient;

  const databaseUrl = (applicationName: string) => {
    const url = new URL(process.env.REAL_E2E_DATABASE_URL!);
    url.searchParams.set('application_name', applicationName);
    return url.toString();
  };

  const createClient = (applicationName: string) =>
    new PrismaClient({
      adapter: new PrismaPg({ connectionString: databaseUrl(applicationName) }),
    });

  const plainTransaction = (client: PrismaClient): TransactionPort => ({
    withTransaction: <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) =>
      client.$transaction(fn),
  });

  const holdAfterRawQuery = (
    client: PrismaClient,
    queryNumber: number,
    onHeld: () => void,
    release: Promise<void>,
  ): TransactionPort => ({
    withTransaction: <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) =>
      client.$transaction(async (rawTx) => {
        let queryCount = 0;
        const tx = new Proxy(rawTx, {
          get(target, property, receiver) {
            if (property !== '$queryRaw') return Reflect.get(target, property, receiver);
            return async (...args: unknown[]) => {
              const queryRaw = Reflect.get(target, property, receiver) as (
                ...queryArgs: unknown[]
              ) => Promise<unknown>;
              const result = await queryRaw.apply(target, args);
              queryCount += 1;
              if (queryCount === queryNumber) {
                onHeld();
                await release;
              }
              return result;
            };
          },
        });
        return fn(tx as Prisma.TransactionClient);
      }),
  });

  const deleteHandler = (client: PrismaClient, transaction = plainTransaction(client)) =>
    new DeleteBookingHandler(client as never, transaction as never);

  const createInvoiceHandler = (
    client: PrismaClient,
    transaction = plainTransaction(client),
  ) =>
    new CreateInvoiceHandler(
      client as never,
      transaction as never,
      { publishOptional: jest.fn().mockResolvedValue(undefined) } as never,
    );

  const processPaymentHandler = (
    client: PrismaClient,
    transaction = plainTransaction(client),
  ) =>
    new ProcessPaymentHandler(
      client as never,
      transaction as never,
      { publish: jest.fn().mockResolvedValue(undefined) } as never,
    );

  const waitForLockWait = async (applicationName: string) => {
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      const waiting = await observer.$queryRaw<Array<{ waiting: boolean }>>`
        SELECT EXISTS (
          SELECT 1 FROM pg_stat_activity
          WHERE application_name = ${applicationName}
            AND wait_event_type = 'Lock'
        ) AS waiting
      `;
      if (waiting[0]?.waiting) return;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error(`Expected ${applicationName} to wait on a database lock`);
  };

  const settleWithin = async <T>(promise: Promise<T>, timeoutMs = 3_000): Promise<Settled<T>> => {
    let timeout: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        promise.then<Settled<T>, Settled<T>>(
          (value) => ({ status: 'fulfilled', value }),
          (reason) => ({ status: 'rejected', reason }),
        ),
        new Promise<Settled<T>>((_, reject) => {
          timeout = setTimeout(
            () => reject(new Error(`Operation did not settle within ${timeoutMs}ms`)),
            timeoutMs,
          );
        }),
      ]);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  };

  const createBooking = async (label: string) => {
    const booking = await fixtureClient.booking.create({
      data: {
        id: randomUUID(),
        branchId: randomUUID(),
        clientId: randomUUID(),
        employeeId: randomUUID(),
        serviceId: randomUUID(),
        bookingType: 'INDIVIDUAL',
        deliveryType: DeliveryType.IN_PERSON,
        status: BookingStatus.COMPLETED,
        scheduledAt: new Date(Date.now() - 7_200_000),
        endsAt: new Date(Date.now() - 3_600_000),
        durationMins: 60,
        price: 10_000,
        bookingNumber: 1_500_000_000 + randomInt(400_000_000),
        notes: label,
      },
    });
    return booking;
  };

  const createInvoice = async (booking: Awaited<ReturnType<typeof createBooking>>) =>
    fixtureClient.invoice.create({
      data: {
        branchId: booking.branchId,
        clientId: booking.clientId,
        employeeId: booking.employeeId,
        bookingId: booking.id,
        subtotal: 10_000,
        discountAmt: 0,
        vatRate: 0,
        vatAmt: 0,
        total: 10_000,
        status: InvoiceStatus.ISSUED,
      },
    });

  const cleanup = async (bookingIds: string[]) => {
    const invoices = await fixtureClient.invoice.findMany({
      where: { bookingId: { in: bookingIds } },
      select: { id: true },
    });
    const invoiceIds = invoices.map(({ id }) => id);
    await fixtureClient.refundRequest.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
    await fixtureClient.paymentCollectionIdempotency.deleteMany({
      where: { invoiceId: { in: invoiceIds } },
    });
    await fixtureClient.payment.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
    await fixtureClient.invoice.deleteMany({ where: { id: { in: invoiceIds } } });
    await fixtureClient.activityLog.deleteMany({
      where: { entity: 'Booking', entityId: { in: bookingIds } },
    });
    await fixtureClient.intakeResponseRevision.deleteMany({
      where: { bookingId: { in: bookingIds } },
    });
    await fixtureClient.intakeResponse.deleteMany({ where: { bookingId: { in: bookingIds } } });
    await fixtureClient.rating.deleteMany({ where: { bookingId: { in: bookingIds } } });
    await fixtureClient.bookingStatusLog.deleteMany({ where: { bookingId: { in: bookingIds } } });
    await fixtureClient.booking.deleteMany({ where: { id: { in: bookingIds } } });
  };

  beforeAll(async () => {
    getRealE2eDatabaseUrl();
    fixtureClient = createClient('t3-delete-fixture');
    deleteClient = createClient('t3-delete-command');
    financeClient = createClient('t3-delete-finance');
    writerClient = createClient('t3-delete-writer');
    observer = createClient('t3-delete-observer');
    await Promise.all([
      fixtureClient.$connect(),
      deleteClient.$connect(),
      financeClient.$connect(),
      writerClient.$connect(),
      observer.$connect(),
    ]);
  });

  afterAll(async () => {
    await Promise.all([
      fixtureClient?.$disconnect(),
      deleteClient?.$disconnect(),
      financeClient?.$disconnect(),
      writerClient?.$disconnect(),
      observer?.$disconnect(),
    ]);
  });

  it('serializes booking-linked invoice creation and deletion in both winner orders without an orphan', async () => {
    const createWinner = await createBooking('create-wins');
    const deleteWinner = await createBooking('delete-wins');
    try {
      let createHeld!: () => void;
      let releaseCreate!: () => void;
      const createHeldPromise = new Promise<void>((resolve) => { createHeld = resolve; });
      const createRelease = new Promise<void>((resolve) => { releaseCreate = resolve; });
      const creating = createInvoiceHandler(
        financeClient,
        holdAfterRawQuery(financeClient, 1, createHeld, createRelease),
      ).execute({
        bookingId: createWinner.id,
        branchId: createWinner.branchId,
        clientId: createWinner.clientId,
        employeeId: createWinner.employeeId,
        subtotal: 10_000,
      });
      await createHeldPromise;
      const deletingAfterCreate = deleteHandler(deleteClient).execute({
        bookingId: createWinner.id,
        changedBy: randomUUID(),
      });
      await waitForLockWait('t3-delete-command');
      releaseCreate();
      await expect(Promise.all([creating, deletingAfterCreate])).resolves.toHaveLength(2);
      expect(await fixtureClient.booking.findUnique({ where: { id: createWinner.id } })).toBeNull();
      expect(await fixtureClient.invoice.count({ where: { bookingId: createWinner.id } })).toBe(0);

      let deleteHeld!: () => void;
      let releaseDelete!: () => void;
      const deleteHeldPromise = new Promise<void>((resolve) => { deleteHeld = resolve; });
      const deleteRelease = new Promise<void>((resolve) => { releaseDelete = resolve; });
      const deleting = deleteHandler(
        deleteClient,
        holdAfterRawQuery(deleteClient, 1, deleteHeld, deleteRelease),
      ).execute({ bookingId: deleteWinner.id, changedBy: randomUUID() });
      await deleteHeldPromise;
      const creatingAfterDelete = createInvoiceHandler(financeClient).execute({
        bookingId: deleteWinner.id,
        branchId: deleteWinner.branchId,
        clientId: deleteWinner.clientId,
        employeeId: deleteWinner.employeeId,
        subtotal: 10_000,
      });
      await waitForLockWait('t3-delete-finance');
      releaseDelete();
      await deleting;
      await expect(creatingAfterDelete).rejects.toMatchObject({ status: 404 });
      expect(await fixtureClient.booking.findUnique({ where: { id: deleteWinner.id } })).toBeNull();
      expect(await fixtureClient.invoice.count({ where: { bookingId: deleteWinner.id } })).toBe(0);
    } finally {
      await cleanup([createWinner.id, deleteWinner.id]);
    }
  });

  it('returns 409 without waiting when ProcessPayment owns the Invoice and 404 when deletion owns it', async () => {
    const financeWinner = await createBooking('process-wins');
    const financeWinnerInvoice = await createInvoice(financeWinner);
    const deleteWinner = await createBooking('delete-before-process');
    const deleteWinnerInvoice = await createInvoice(deleteWinner);
    try {
      let financeHeld!: () => void;
      let releaseFinance!: () => void;
      const financeHeldPromise = new Promise<void>((resolve) => { financeHeld = resolve; });
      const financeRelease = new Promise<void>((resolve) => { releaseFinance = resolve; });
      const payment = processPaymentHandler(
        financeClient,
        holdAfterRawQuery(financeClient, 1, financeHeld, financeRelease),
      ).execute({
        invoiceId: financeWinnerInvoice.id,
        amount: 10_000,
        method: PaymentMethod.CASH,
        idempotencyKey: randomUUID(),
      });
      await financeHeldPromise;
      const deletion = deleteHandler(deleteClient).execute({
        bookingId: financeWinner.id,
        changedBy: randomUUID(),
      });
      const deletionResult = await settleWithin(deletion);
      expect(deletionResult).toMatchObject({ status: 'rejected', reason: { status: 409 } });
      releaseFinance();
      await expect(payment).resolves.toMatchObject({ invoiceId: financeWinnerInvoice.id });
      expect(await fixtureClient.booking.findUnique({ where: { id: financeWinner.id } })).not.toBeNull();

      let deletionHeld!: () => void;
      let releaseDeletion!: () => void;
      const deletionHeldPromise = new Promise<void>((resolve) => { deletionHeld = resolve; });
      const deletionRelease = new Promise<void>((resolve) => { releaseDeletion = resolve; });
      const deletionFirst = deleteHandler(
        deleteClient,
        holdAfterRawQuery(deleteClient, 5, deletionHeld, deletionRelease),
      ).execute({ bookingId: deleteWinner.id, changedBy: randomUUID() });
      await deletionHeldPromise;
      const paymentAfterDelete = processPaymentHandler(financeClient).execute({
        invoiceId: deleteWinnerInvoice.id,
        amount: 10_000,
        method: PaymentMethod.CASH,
        idempotencyKey: randomUUID(),
      });
      await waitForLockWait('t3-delete-finance');
      releaseDeletion();
      await deletionFirst;
      await expect(paymentAfterDelete).rejects.toMatchObject({ status: 404 });
      expect(await fixtureClient.booking.findUnique({ where: { id: deleteWinner.id } })).toBeNull();
      expect(await fixtureClient.payment.count({ where: { invoiceId: deleteWinnerInvoice.id } })).toBe(0);
    } finally {
      await cleanup([financeWinner.id, deleteWinner.id]);
    }
  });

  it('returns 409 without waiting on an existing Payment-first writer', async () => {
    const booking = await createBooking('existing-payment-first');
    const invoice = await createInvoice(booking);
    const payment = await fixtureClient.payment.create({
      data: {
        invoiceId: invoice.id,
        amount: 10_000,
        method: PaymentMethod.ONLINE_CARD,
        status: 'PENDING',
        gatewayRef: randomUUID(),
      },
    });
    let writerHeld!: () => void;
    let releaseWriter!: () => void;
    const writerHeldPromise = new Promise<void>((resolve) => { writerHeld = resolve; });
    const writerRelease = new Promise<void>((resolve) => { releaseWriter = resolve; });
    const writer = writerClient.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Payment" WHERE "id" = ${payment.id} FOR UPDATE`;
      writerHeld();
      await writerRelease;
      await tx.invoice.update({ where: { id: invoice.id }, data: { notes: 'writer-finished' } });
    });
    try {
      await writerHeldPromise;
      const deletionResult = await settleWithin(
        deleteHandler(deleteClient).execute({ bookingId: booking.id, changedBy: randomUUID() }),
      );
      expect(deletionResult).toMatchObject({ status: 'rejected', reason: { status: 409 } });
      releaseWriter();
      await writer;
      expect(await fixtureClient.payment.findUnique({ where: { id: payment.id } })).not.toBeNull();
      expect(await fixtureClient.booking.findUnique({ where: { id: booking.id } })).not.toBeNull();
    } finally {
      releaseWriter();
      await writer.catch(() => undefined);
      await cleanup([booking.id]);
    }
  });

  it('returns 409 while a new Payment holds the implicit Invoice FK lock', async () => {
    const booking = await createBooking('new-payment-fk-lock');
    const invoice = await createInvoice(booking);
    let writerHeld!: () => void;
    let releaseWriter!: () => void;
    const writerHeldPromise = new Promise<void>((resolve) => { writerHeld = resolve; });
    const writerRelease = new Promise<void>((resolve) => { releaseWriter = resolve; });
    const paymentId = randomUUID();
    const writer = writerClient.$transaction(async (tx) => {
      await tx.payment.create({
        data: {
          id: paymentId,
          invoiceId: invoice.id,
          amount: 10_000,
          method: PaymentMethod.ONLINE_CARD,
          status: 'PENDING',
          gatewayRef: randomUUID(),
        },
      });
      writerHeld();
      await writerRelease;
      await tx.invoice.update({ where: { id: invoice.id }, data: { notes: 'fk-writer-finished' } });
    });
    try {
      await writerHeldPromise;
      const deletionResult = await settleWithin(
        deleteHandler(deleteClient).execute({ bookingId: booking.id, changedBy: randomUUID() }),
      );
      expect(deletionResult).toMatchObject({ status: 'rejected', reason: { status: 409 } });
      releaseWriter();
      await writer;
      expect(await fixtureClient.payment.findUnique({ where: { id: paymentId } })).not.toBeNull();
      expect(await fixtureClient.booking.findUnique({ where: { id: booking.id } })).not.toBeNull();
    } finally {
      releaseWriter();
      await writer.catch(() => undefined);
      await cleanup([booking.id]);
    }
  });

  it('deletes collection idempotency before its Invoice and Booking', async () => {
    const booking = await createBooking('collection-idempotency-cleanup');
    const invoice = await createInvoice(booking);
    const record = await fixtureClient.paymentCollectionIdempotency.create({
      data: {
        idempotencyKey: randomUUID(),
        invoiceId: invoice.id,
        requestFingerprint: randomUUID(),
      },
    });
    try {
      await deleteHandler(deleteClient).execute({ bookingId: booking.id, changedBy: randomUUID() });
      expect(
        await fixtureClient.paymentCollectionIdempotency.findUnique({ where: { id: record.id } }),
      ).toBeNull();
      expect(await fixtureClient.invoice.findUnique({ where: { id: invoice.id } })).toBeNull();
      expect(await fixtureClient.booking.findUnique({ where: { id: booking.id } })).toBeNull();
    } finally {
      await cleanup([booking.id]);
    }
  });
});
