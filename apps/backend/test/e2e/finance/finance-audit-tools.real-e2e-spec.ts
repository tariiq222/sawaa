import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { getRealE2eDatabaseUrl } from '../../helpers/create-real-e2e-app';
import { auditFinanceBookings, type FinanceBookingsAuditPage } from '../../../scripts/data-integrity/audit-finance-bookings';
import { runAuditCli } from '../../../scripts/data-integrity/audit-finance-cli';

const PREFIX = 'r1_audit_ecfc_';
const NOW = new Date('2026-09-05T00:00:00.000Z');
const createLoggedClient = (databaseUrl: string) => new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
  log: [{ emit: 'event', level: 'query' }],
});

interface FixtureSnapshotRow {
  entity: string;
  rowCount: number;
  contentChecksum: string;
}

async function fixtureSnapshot(
  prisma: PrismaClient,
  ids: { booking: string[]; invoice: string[]; payment: string[]; refund: string[]; intake: string[]; form: string; outbox: string[]; client: string; employee: string },
): Promise<FixtureSnapshotRow[]> {
  const [client, employee, booking, invoice, payment, refund, intake, form, outbox] = await Promise.all([
    prisma.$queryRaw<FixtureSnapshotRow[]>(Prisma.sql`SELECT 'Client' AS entity, count(*)::int AS "rowCount", md5(COALESCE(string_agg(to_jsonb(x)::text, '|' ORDER BY x."id"), '')) AS "contentChecksum" FROM (SELECT * FROM "Client" WHERE "id" = ${ids.client}) x`),
    prisma.$queryRaw<FixtureSnapshotRow[]>(Prisma.sql`SELECT 'Employee' AS entity, count(*)::int AS "rowCount", md5(COALESCE(string_agg(to_jsonb(x)::text, '|' ORDER BY x."id"), '')) AS "contentChecksum" FROM (SELECT * FROM "Employee" WHERE "id" = ${ids.employee}) x`),
    prisma.$queryRaw<FixtureSnapshotRow[]>(Prisma.sql`SELECT 'Booking' AS entity, count(*)::int AS "rowCount", md5(COALESCE(string_agg(to_jsonb(x)::text, '|' ORDER BY x."id"), '')) AS "contentChecksum" FROM (SELECT * FROM "Booking" WHERE "id" IN (${Prisma.join(ids.booking)})) x`),
    prisma.$queryRaw<FixtureSnapshotRow[]>(Prisma.sql`SELECT 'Invoice' AS entity, count(*)::int AS "rowCount", md5(COALESCE(string_agg(to_jsonb(x)::text, '|' ORDER BY x."id"), '')) AS "contentChecksum" FROM (SELECT * FROM "Invoice" WHERE "id" IN (${Prisma.join(ids.invoice)})) x`),
    prisma.$queryRaw<FixtureSnapshotRow[]>(Prisma.sql`SELECT 'Payment' AS entity, count(*)::int AS "rowCount", md5(COALESCE(string_agg(to_jsonb(x)::text, '|' ORDER BY x."id"), '')) AS "contentChecksum" FROM (SELECT * FROM "Payment" WHERE "id" IN (${Prisma.join(ids.payment)})) x`),
    prisma.$queryRaw<FixtureSnapshotRow[]>(Prisma.sql`SELECT 'RefundRequest' AS entity, count(*)::int AS "rowCount", md5(COALESCE(string_agg(to_jsonb(x)::text, '|' ORDER BY x."id"), '')) AS "contentChecksum" FROM (SELECT * FROM "RefundRequest" WHERE "id" IN (${Prisma.join(ids.refund)})) x`),
    prisma.$queryRaw<FixtureSnapshotRow[]>(Prisma.sql`SELECT 'IntakeResponse' AS entity, count(*)::int AS "rowCount", md5(COALESCE(string_agg(to_jsonb(x)::text, '|' ORDER BY x."id"), '')) AS "contentChecksum" FROM (SELECT * FROM "IntakeResponse" WHERE "id" IN (${Prisma.join(ids.intake)})) x`),
    prisma.$queryRaw<FixtureSnapshotRow[]>(Prisma.sql`SELECT 'IntakeForm' AS entity, count(*)::int AS "rowCount", md5(COALESCE(string_agg(to_jsonb(x)::text, '|' ORDER BY x."id"), '')) AS "contentChecksum" FROM (SELECT * FROM "IntakeForm" WHERE "id" = ${ids.form}) x`),
    prisma.$queryRaw<FixtureSnapshotRow[]>(Prisma.sql`SELECT 'OutboxEvent' AS entity, count(*)::int AS "rowCount", md5(COALESCE(string_agg(to_jsonb(x)::text, '|' ORDER BY x."id"), '')) AS "contentChecksum" FROM (SELECT * FROM "OutboxEvent" WHERE "id" IN (${Prisma.join(ids.outbox.map((id) => Prisma.sql`${id}::uuid`))})) x`),
  ]);
  return [client, employee, booking, invoice, payment, refund, intake, form, outbox].map((rows) => rows[0]!);
}

describe('finance/bookings read-only audit (real database)', () => {
  let prisma: ReturnType<typeof createLoggedClient>;
  const clientId = `${PREFIX}client`;
  const employeeId = `${PREFIX}employee`;
  const formId = `${PREFIX}form`;
  const bookingIds: string[] = [];
  const invoiceIds: string[] = [];
  const paymentIds: string[] = [];
  const refundIds: string[] = [];
  const intakeIds = [`${PREFIX}response_a`, `${PREFIX}response_b`];
  const outboxIds: string[] = [];

  beforeAll(async () => {
    const databaseUrl = getRealE2eDatabaseUrl();
    prisma = createLoggedClient(databaseUrl);
    await prisma.$connect();
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO "Client" ("id", "name", "createdAt", "updatedAt") VALUES (${clientId}, ${'R1 audit synthetic client'}, ${NOW}, ${NOW})
    `);
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO "Employee" ("id", "name", "createdAt", "updatedAt") VALUES (${employeeId}, ${'R1 audit synthetic employee'}, ${NOW}, ${NOW})
    `);

    for (let index = 0; index < 105; index += 1) {
      const bookingId = `${PREFIX}over_booking_${String(index).padStart(3, '0')}`;
      const invoiceId = `${PREFIX}over_invoice_${String(index).padStart(3, '0')}`;
      const paymentId = `${PREFIX}over_payment_${String(index).padStart(3, '0')}`;
      bookingIds.push(bookingId);
      invoiceIds.push(invoiceId);
      paymentIds.push(paymentId);
      await prisma.$executeRaw(Prisma.sql`
        INSERT INTO "Booking" ("id", "branchId", "clientId", "employeeId", "deliveryType", "scheduledAt", "endsAt", "durationMins", "price", "bookingNumber", "status", "bookingType", "source", "createdAt", "updatedAt")
        VALUES (${bookingId}, ${`${PREFIX}branch`}, ${clientId}, ${employeeId}, 'IN_PERSON', ${new Date(NOW.getTime() + index * 7200000)}, ${new Date(NOW.getTime() + index * 7200000 + 3600000)}, 60, 1, ${900000 + index}, 'CONFIRMED', 'INDIVIDUAL', 'RECEPTION', ${NOW}, ${NOW})
      `);
      await prisma.$executeRaw(Prisma.sql`
        INSERT INTO "Invoice" ("id", "branchId", "clientId", "employeeId", "bookingId", "subtotal", "vatAmt", "total", "status", "createdAt", "updatedAt")
        VALUES (${invoiceId}, ${`${PREFIX}branch`}, ${clientId}, ${employeeId}, ${bookingId}, 1, 0, 1, 'ISSUED', ${NOW}, ${NOW})
      `);
      await prisma.$executeRaw(Prisma.sql`
        INSERT INTO "Payment" ("id", "invoiceId", "amount", "method", "status", "createdAt", "updatedAt")
        VALUES (${paymentId}, ${invoiceId}, 2, 'CASH', 'COMPLETED', ${NOW}, ${NOW})
      `);
    }

    const packageInvoice = `${PREFIX}package_invoice`;
    const packagePayment = `${PREFIX}package_payment`;
    invoiceIds.push(packageInvoice);
    paymentIds.push(packagePayment);
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO "Invoice" ("id", "branchId", "clientId", "employeeId", "packagePurchaseId", "subtotal", "vatAmt", "total", "status", "createdAt", "updatedAt")
      VALUES (${packageInvoice}, ${`${PREFIX}branch`}, ${clientId}, ${employeeId}, ${`${PREFIX}package_purchase`}, 3, 0, 3, 'ISSUED', ${NOW}, ${NOW})
    `);
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO "Payment" ("id", "invoiceId", "amount", "method", "status", "createdAt", "updatedAt")
      VALUES (${packagePayment}, ${packageInvoice}, 5, 'CASH', 'COMPLETED', ${NOW}, ${NOW})
    `);

    const mismatchBooking = `${PREFIX}mismatch_booking`;
    const mismatchInvoice = `${PREFIX}mismatch_invoice`;
    const mismatchPayment = `${PREFIX}mismatch_payment`;
    bookingIds.push(mismatchBooking);
    invoiceIds.push(mismatchInvoice);
    paymentIds.push(mismatchPayment);
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO "Booking" ("id", "branchId", "clientId", "employeeId", "deliveryType", "scheduledAt", "endsAt", "durationMins", "price", "bookingNumber", "status", "bookingType", "source", "createdAt", "updatedAt")
      VALUES (${mismatchBooking}, ${`${PREFIX}branch`}, ${clientId}, ${employeeId}, 'IN_PERSON', ${new Date(NOW.getTime() + 1000 * 3600000)}, ${new Date(NOW.getTime() + 1001 * 3600000)}, 60, 10, 910000, 'CONFIRMED', 'INDIVIDUAL', 'RECEPTION', ${NOW}, ${NOW})
    `);
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO "Invoice" ("id", "branchId", "clientId", "employeeId", "bookingId", "subtotal", "vatAmt", "total", "status", "createdAt", "updatedAt")
      VALUES (${mismatchInvoice}, ${`${PREFIX}branch`}, ${clientId}, ${employeeId}, ${mismatchBooking}, 10, 0, 10, 'ISSUED', ${NOW}, ${NOW})
    `);
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO "Payment" ("id", "invoiceId", "amount", "refundedAmount", "method", "status", "createdAt", "updatedAt")
      VALUES (${mismatchPayment}, ${mismatchInvoice}, 10, 4, 'CASH', 'COMPLETED', ${NOW}, ${NOW})
    `);

    const matchedBooking = `${PREFIX}matched_booking`;
    const matchedInvoice = `${PREFIX}matched_invoice`;
    const matchedPayment = `${PREFIX}matched_payment`;
    const matchedRefund = `${PREFIX}matched_refund`;
    bookingIds.push(matchedBooking);
    invoiceIds.push(matchedInvoice);
    paymentIds.push(matchedPayment);
    refundIds.push(matchedRefund);
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO "Booking" ("id", "branchId", "clientId", "employeeId", "deliveryType", "scheduledAt", "endsAt", "durationMins", "price", "bookingNumber", "status", "bookingType", "source", "createdAt", "updatedAt")
      VALUES (${matchedBooking}, ${`${PREFIX}branch`}, ${clientId}, ${employeeId}, 'IN_PERSON', ${new Date(NOW.getTime() + 1002 * 3600000)}, ${new Date(NOW.getTime() + 1003 * 3600000)}, 60, 100, 910001, 'CONFIRMED', 'INDIVIDUAL', 'RECEPTION', ${NOW}, ${NOW})
    `);
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO "Invoice" ("id", "branchId", "clientId", "employeeId", "bookingId", "subtotal", "vatAmt", "total", "status", "createdAt", "updatedAt")
      VALUES (${matchedInvoice}, ${`${PREFIX}branch`}, ${clientId}, ${employeeId}, ${matchedBooking}, 100, 0, 100, 'ISSUED', ${NOW}, ${NOW})
    `);
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO "Payment" ("id", "invoiceId", "amount", "refundedAmount", "method", "status", "createdAt", "updatedAt")
      VALUES (${matchedPayment}, ${matchedInvoice}, 100, 10, 'CASH', 'PARTIALLY_REFUNDED', ${NOW}, ${NOW})
    `);
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO "RefundRequest" ("id", "invoiceId", "paymentId", "clientId", "amount", "status", "processedAt", "createdAt", "updatedAt")
      VALUES (${matchedRefund}, ${matchedInvoice}, ${matchedPayment}, ${clientId}, 10, 'COMPLETED', ${NOW}, ${NOW}, ${NOW})
    `);

    const statusBooking = `${PREFIX}status_booking`;
    const statusInvoice = `${PREFIX}status_invoice`;
    bookingIds.push(statusBooking);
    invoiceIds.push(statusInvoice);
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO "Booking" ("id", "branchId", "clientId", "employeeId", "deliveryType", "scheduledAt", "endsAt", "durationMins", "price", "bookingNumber", "status", "bookingType", "source", "createdAt", "updatedAt")
      VALUES (${statusBooking}, ${`${PREFIX}branch`}, ${clientId}, ${employeeId}, 'IN_PERSON', ${new Date(NOW.getTime() + 1004 * 3600000)}, ${new Date(NOW.getTime() + 1005 * 3600000)}, 60, 100, 910002, 'DEPOSIT_PAID', 'INDIVIDUAL', 'RECEPTION', ${NOW}, ${NOW})
    `);
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO "Invoice" ("id", "branchId", "clientId", "employeeId", "bookingId", "subtotal", "vatAmt", "total", "status", "createdAt", "updatedAt")
      VALUES (${statusInvoice}, ${`${PREFIX}branch`}, ${clientId}, ${employeeId}, ${statusBooking}, 100, 0, 100, 'PAID', ${NOW}, ${NOW})
    `);

    const missingBooking = `${PREFIX}missing_booking`;
    bookingIds.push(missingBooking);
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO "Booking" ("id", "branchId", "clientId", "employeeId", "deliveryType", "scheduledAt", "endsAt", "durationMins", "price", "bookingNumber", "status", "bookingType", "source", "createdAt", "updatedAt")
      VALUES (${missingBooking}, ${`${PREFIX}branch`}, ${`${PREFIX}missing_client`}, ${`${PREFIX}missing_employee`}, 'IN_PERSON', ${new Date(NOW.getTime() + 1006 * 3600000)}, ${new Date(NOW.getTime() + 1007 * 3600000)}, 60, 1, 910003, 'CONFIRMED', 'INDIVIDUAL', 'RECEPTION', ${NOW}, ${NOW})
    `);

    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO "IntakeForm" ("id", "nameAr", "createdAt", "updatedAt") VALUES (${formId}, ${'R1 audit synthetic form'}, ${NOW}, ${NOW})
    `);
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO "IntakeResponse" ("id", "formId", "bookingId", "clientId", "answers", "createdAt")
      VALUES (${intakeIds[0]}, ${formId}, ${`${PREFIX}intake_booking`}, ${clientId}, ${JSON.stringify({ q: 'a' })}::jsonb, ${NOW}),
             (${intakeIds[1]}, ${formId}, ${`${PREFIX}intake_booking`}, ${clientId}, ${JSON.stringify({ q: 'b' })}::jsonb, ${NOW})
    `);

    const outboxId = randomUUID();
    outboxIds.push(outboxId);
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO "OutboxEvent" ("id", "aggregateId", "eventType", "payload", "status", "createdAt")
      VALUES (${outboxId}::uuid, ${`${PREFIX}outbox_aggregate`}, 'R1_AUDIT_SYNTHETIC', '{}'::jsonb, 'PENDING', ${new Date('2026-09-01T00:00:00.000Z')})
    `);
  });

  afterAll(async () => {
    if (!prisma) return;
    if (outboxIds.length) await prisma.$executeRaw(Prisma.sql`DELETE FROM "OutboxEvent" WHERE "id" IN (${Prisma.join(outboxIds.map((id) => Prisma.sql`${id}::uuid`))})`);
    if (intakeIds.length) await prisma.$executeRaw(Prisma.sql`DELETE FROM "IntakeResponse" WHERE "id" IN (${Prisma.join(intakeIds)})`);
    await prisma.$executeRaw(Prisma.sql`DELETE FROM "IntakeForm" WHERE "id" = ${formId}`);
    if (refundIds.length) await prisma.$executeRaw(Prisma.sql`DELETE FROM "RefundRequest" WHERE "id" IN (${Prisma.join(refundIds)})`);
    if (paymentIds.length) await prisma.$executeRaw(Prisma.sql`DELETE FROM "Payment" WHERE "id" IN (${Prisma.join(paymentIds)})`);
    if (invoiceIds.length) await prisma.$executeRaw(Prisma.sql`DELETE FROM "Invoice" WHERE "id" IN (${Prisma.join(invoiceIds)})`);
    if (bookingIds.length) await prisma.$executeRaw(Prisma.sql`DELETE FROM "Booking" WHERE "id" IN (${Prisma.join(bookingIds)})`);
    await prisma.$executeRaw(Prisma.sql`DELETE FROM "Employee" WHERE "id" = ${employeeId}`);
    await prisma.$executeRaw(Prisma.sql`DELETE FROM "Client" WHERE "id" = ${clientId}`);
    await prisma.$disconnect();
  });

  it('finds all categories without writing and resumes beyond the 100-row page', async () => {
    const queries: string[] = [];
    prisma.$on('query', (event) => queries.push(event.query));
    const identityCheck = await prisma.$queryRaw<Array<{ client: string | null; employee: string | null }>>(Prisma.sql`
      SELECT (SELECT "id" FROM "Client" WHERE "id" = ${clientId}) AS client,
             (SELECT "id" FROM "Employee" WHERE "id" = ${employeeId}) AS employee
    `);
    expect(identityCheck[0]).toEqual({ client: clientId, employee: employeeId });
    const fixtureIds = {
      booking: bookingIds, invoice: invoiceIds, payment: paymentIds, refund: refundIds,
      intake: intakeIds, form: formId, outbox: outboxIds, client: clientId, employee: employeeId,
    };
    const beforeSnapshot = await fixtureSnapshot(prisma, fixtureIds);
    const auditQueryStart = queries.length;
    const pages: FinanceBookingsAuditPage[] = [];
    let cursors;
    let completedCategories: FinanceBookingsAuditPage['completedCategories'] = [];
    for (let pageNumber = 0; pageNumber < 8; pageNumber += 1) {
      const page = await auditFinanceBookings(prisma, {
        batchSize: 100, cursors, completedCategories, now: NOW,
      });
      pages.push(page);
      if (page.nextCompletedCategories.length === 6) break;
      cursors = page.nextCursors;
      completedCategories = page.nextCompletedCategories;
    }

    expect(pages.at(-1)?.complete).toBe(false);
    expect(pages.at(-1)?.completion).toBe('RESUMED_UNVERIFIED');
    expect(pages.length).toBeGreaterThan(1);
    const findings = pages.flatMap((page) => page.findings);
    expect(new Set(findings.map((finding) => finding.evidenceId)).size).toBe(findings.length);
    expect(findings.filter((finding) => finding.category === 'INVOICE_OVER_COLLECTION')).toHaveLength(106);
    expect(findings.some((finding) => finding.invoiceId === `${PREFIX}package_invoice` && finding.packagePurchaseId === `${PREFIX}package_purchase`)).toBe(true);
    expect(findings.some((finding) => finding.category === 'PAYMENT_REFUND_MISMATCH' && finding.paymentId === `${PREFIX}mismatch_payment`)).toBe(true);
    expect(findings.some((finding) => finding.category === 'INVOICE_BOOKING_STATUS_MISMATCH' && finding.bookingId === `${PREFIX}status_booking`)).toBe(true);
    expect(findings.filter((finding) => finding.category === 'MISSING_PERSON_REFERENCE')).toHaveLength(2);
    expect(findings.some((finding) => finding.category === 'INTAKE_CURRENT_DUPLICATE' && finding.currentCount === 2)).toBe(true);
    expect(findings.some((finding) => finding.category === 'STALLED_OUTBOX' && finding.evidenceId === `OutboxEvent:${outboxIds[0]}`)).toBe(true);
    expect(findings.some((finding) => finding.paymentId === `${PREFIX}matched_payment`)).toBe(false);
    expect(pages[0]!.scanned.INVOICE_OVER_COLLECTION).toBe(100);

    const checksums = pages.map((page) => page.checksum);
    const repeat = await auditFinanceBookings(prisma, { batchSize: 100, now: NOW });
    expect(repeat.checksum).toBe(pages[0]!.checksum);
    expect(checksums.every((value) => /^[0-9a-f]{64}$/.test(value))).toBe(true);
    const auditQueryEnd = queries.length;
    const auditQueries = queries.slice(auditQueryStart);
    expect(auditQueries.some((query) => /SET TRANSACTION READ ONLY/i.test(query))).toBe(true);
    expect(auditQueries.some((query) => /SELECT current_database\(\)/i.test(query))).toBe(true);
    expect(auditQueries.every((query) => !/\b(INSERT|UPDATE|DELETE)\b/i.test(query))).toBe(true);
    const afterSnapshot = await fixtureSnapshot(prisma, fixtureIds);
    expect(afterSnapshot).toEqual(beforeSnapshot);
    expect(auditQueryEnd).toBeGreaterThan(auditQueryStart);
  });

  it('writes an exclusive mode-0600 page and refuses overwrite without leaking database details', async () => {
    const directory = await mkdtemp(join('/tmp', 'sawaa-r1-audit-'));
    const output = join(directory, 'page.json');
    try {
      const page = await runAuditCli(['--output', output, '--batch-size', '1'], {
        DATABASE_URL: getRealE2eDatabaseUrl(),
      });
      expect((await stat(output)).mode & 0o777).toBe(0o600);
      expect(JSON.parse(await readFile(output, 'utf8'))).toMatchObject({
        ruleVersion: page.ruleVersion, checksum: page.checksum,
      });
      await expect(runAuditCli(['--output', output, '--batch-size', '1'], {
        DATABASE_URL: getRealE2eDatabaseUrl(),
      })).rejects.toThrow('Refusing to overwrite existing output');
      await expect(runAuditCli(['--output', output], {})).rejects.toThrow('DATABASE_URL is required');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
