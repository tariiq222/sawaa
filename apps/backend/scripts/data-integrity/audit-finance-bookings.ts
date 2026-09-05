import { createHash } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';

/**
 * Read-only historical finance/bookings inventory.
 *
 * This module deliberately has no repair path. A page is repeatable-read and
 * PostgreSQL enforces READ ONLY for the transaction, so callers cannot turn a
 * dry-run into a write by accident. Amounts are converted from numeric text
 * with BigInt before crossing the read boundary; binary floating point is
 * never used for accounting arithmetic.
 */

export const AUDIT_RULE_VERSION = 'r1-finance-bookings-1';
export const DEFAULT_AUDIT_BATCH_SIZE = 100;
export const DEFAULT_STALLED_OUTBOX_HOURS = 24;

export const AUDIT_CATEGORIES = [
  'INVOICE_OVER_COLLECTION',
  'PAYMENT_REFUND_MISMATCH',
  'INVOICE_BOOKING_STATUS_MISMATCH',
  'MISSING_PERSON_REFERENCE',
  'INTAKE_CURRENT_DUPLICATE',
  'STALLED_OUTBOX',
] as const;

export type AuditCategory = (typeof AUDIT_CATEGORIES)[number];
export type AuditSeverity = 'REVIEW_REQUIRED';
export type AuditCompletion = 'FULL_FRESH_PASS' | 'PAGE_ONLY' | 'RESUMED_UNVERIFIED';

export type AuditCursor = Partial<Record<AuditCategory, string>>;

export interface AuditFinding {
  category: AuditCategory;
  severity: AuditSeverity;
  /** Stable internal evidence identifier, safe for protected operator output. */
  evidenceId: string;
  reasonCode: string;
  entityId: string;
  invoiceId?: string;
  bookingId?: string;
  packagePurchaseId?: string;
  paymentId?: string;
  referenceType?: 'client' | 'employee';
  referenceId?: string;
  sourceIds?: string[];
  amountHalalas?: number;
  grossSettledHalalas?: number;
  refundedSettledHalalas?: number;
  recordedRefundedHalalas?: number;
  completedRefundedHalalas?: number;
  differenceHalalas?: number;
  currentCount?: number;
  createdAt?: string;
}

export interface FinanceBookingsAuditPage {
  schemaVersion: 1;
  ruleVersion: string;
  database: string;
  schema: string;
  generatedAt: string;
  stalledOutboxHours: number;
  batchSize: number;
  cursors: AuditCursor;
  nextCursors: AuditCursor;
  completedCategories: AuditCategory[];
  nextCompletedCategories: AuditCategory[];
  complete: boolean;
  /** `complete` is true only for a fresh pass that exhausted every source family. */
  completion: AuditCompletion;
  /** Counts and checksums describe this page only when complete is false. */
  counts: Record<AuditCategory, number>;
  scanned: Record<AuditCategory, number>;
  totalFindings: number;
  checksum: string;
  findings: AuditFinding[];
}

export interface FinanceBookingsAuditOptions {
  batchSize?: number;
  cursors?: AuditCursor;
  /** Categories already exhausted by an earlier page; avoids repeating findings. */
  completedCategories?: readonly AuditCategory[];
  stalledOutboxHours?: number;
  /** Injected in tests so the stalled threshold is deterministic. */
  now?: Date;
}

interface IdentityRow {
  database: string;
  schema: string;
}

interface InvoiceOverCollectionRow {
  invoiceId: string;
  bookingId: string | null;
  packagePurchaseId: string | null;
  invoiceTotal: string | number;
  grossSettled: string | number;
  refundedSettled: string | number;
}

interface PaymentRefundMismatchRow {
  paymentId: string;
  invoiceId: string;
  recordedRefunded: string | number;
  completedRefunded: string | number;
}

interface StatusMismatchRow {
  invoiceId: string;
  bookingId: string;
  invoiceStatus: string;
  bookingStatus: string;
}

interface MissingPersonRow {
  evidenceId: string;
  entityId: string;
  entityType: 'Booking' | 'Invoice';
  referenceType: 'client' | 'employee';
  referenceId: string;
  personExists: boolean;
}

interface IntakeDuplicateRow {
  evidenceId: string;
  bookingId: string;
  formId: string;
  sourceIds: string[];
  currentCount: number | string;
}

interface StalledOutboxRow {
  id: string;
  aggregateId: string;
  status: string;
  createdAt: Date | string;
}

type RawReadTransaction = {
  $executeRaw: <T = unknown>(query: Prisma.Sql) => Promise<T>;
  $queryRaw: <T = unknown>(query: Prisma.Sql) => Promise<T>;
};
type CategoryPage<T> = { rows: T[]; next?: string };

type ReadPrisma = Pick<PrismaClient, '$transaction'>;

function fail(message: string): never {
  throw new Error(message);
}

function validatePositiveInteger(value: number, name: string, max: number): number {
  if (!Number.isInteger(value) || value < 1 || value > max) {
    fail(`${name} must be an integer from 1 to ${max}`);
  }
  return value;
}

function validateHours(value: number): number {
  if (!Number.isFinite(value) || value <= 0 || value > 24 * 365) {
    fail('stalledOutboxHours must be a finite number greater than 0 and at most 8760');
  }
  return value;
}

/** Convert a whole-halalah numeric value without rounding or precision loss. */
export function parseHalalas(value: string | number | bigint): number {
  const text = typeof value === 'bigint' ? value.toString() : String(value).trim();
  if (!/^-?\d+(?:\.0{1,2})?$/.test(text)) {
    fail(`Non-integral monetary value returned by database: ${text}`);
  }
  const amount = BigInt(text.split('.')[0]!);
  const max = BigInt(Number.MAX_SAFE_INTEGER);
  if (amount < 0n || amount > max) fail('Monetary value is outside safe integer halala range');
  return Number(amount);
}

function positiveDifference(left: number, right: number): number {
  const difference = BigInt(left) - BigInt(right);
  if (difference < 0n) return Number(-difference);
  return Number(difference);
}

function isoDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) fail('Database returned an invalid timestamp');
  return date.toISOString();
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(',')}}`;
}

function checksum(findings: AuditFinding[]): string {
  return createHash('sha256').update(stableJson(findings)).digest('hex');
}

function emptyCounts(): Record<AuditCategory, number> {
  return Object.fromEntries(AUDIT_CATEGORIES.map((category) => [category, 0])) as Record<AuditCategory, number>;
}

function limitAndCursor<T>(rows: T[], batchSize: number, key: (row: T) => string): { rows: T[]; next?: string } {
  if (rows.length <= batchSize) return { rows };
  const page = rows.slice(0, batchSize);
  return { rows: page, next: key(page[page.length - 1]!) };
}

function categoryCursor(cursors: AuditCursor, category: AuditCategory): string | null {
  const value = cursors[category];
  return value?.trim() ? value : null;
}

function isCompleted(completed: readonly AuditCategory[], category: AuditCategory): boolean {
  return completed.includes(category);
}

async function readCategory<T>(
  tx: RawReadTransaction,
  category: AuditCategory,
  cursor: string | null,
  batchSize: number,
  sql: (cursor: string | null, limit: number) => Prisma.Sql,
): Promise<CategoryPage<T>> {
  const rows = await tx.$queryRaw<T[]>(sql(cursor, batchSize + 1));
  return limitAndCursor(rows, batchSize, (row) => {
    if (category === 'INVOICE_OVER_COLLECTION') return (row as InvoiceOverCollectionRow).invoiceId;
    if (category === 'PAYMENT_REFUND_MISMATCH') return (row as PaymentRefundMismatchRow).paymentId;
    if (category === 'INVOICE_BOOKING_STATUS_MISMATCH') return (row as StatusMismatchRow).invoiceId;
    if (category === 'MISSING_PERSON_REFERENCE') return (row as MissingPersonRow).evidenceId;
    if (category === 'INTAKE_CURRENT_DUPLICATE') return (row as IntakeDuplicateRow).evidenceId;
    return (row as StalledOutboxRow).id;
  });
}

function invoiceOverCollectionSql(cursor: string | null, limit: number): Prisma.Sql {
  return Prisma.sql`
    SELECT i."id" AS "invoiceId", i."bookingId", i."packagePurchaseId",
      i."total"::text AS "invoiceTotal",
      COALESCE(p."grossSettled", 0)::text AS "grossSettled",
      COALESCE(r."refundedSettled", 0)::text AS "refundedSettled"
    FROM "Invoice" i
    LEFT JOIN (
      SELECT "invoiceId", SUM("amount") AS "grossSettled"
      FROM "Payment"
      WHERE "status" IN ('COMPLETED', 'PARTIALLY_REFUNDED', 'REFUNDED')
      GROUP BY "invoiceId"
    ) p ON p."invoiceId" = i."id"
    LEFT JOIN (
      SELECT "invoiceId", SUM("amount") AS "refundedSettled"
      FROM "RefundRequest"
      WHERE "status" = 'COMPLETED'
      GROUP BY "invoiceId"
    ) r ON r."invoiceId" = i."id"
    WHERE ${cursor === null ? Prisma.sql`TRUE` : Prisma.sql`i."id" > ${cursor}`}
    ORDER BY i."id" ASC
    LIMIT ${limit}
  `;
}

function paymentRefundMismatchSql(cursor: string | null, limit: number): Prisma.Sql {
  return Prisma.sql`
    SELECT p."id" AS "paymentId", p."invoiceId",
      p."refundedAmount"::text AS "recordedRefunded",
      COALESCE(SUM(r."amount") FILTER (WHERE r."status" = 'COMPLETED'), 0)::text AS "completedRefunded"
    FROM "Payment" p
    LEFT JOIN "RefundRequest" r ON r."paymentId" = p."id"
    WHERE ${cursor === null ? Prisma.sql`TRUE` : Prisma.sql`p."id" > ${cursor}`}
    GROUP BY p."id", p."invoiceId", p."refundedAmount"
    ORDER BY p."id" ASC
    LIMIT ${limit}
  `;
}

function statusMismatchSql(cursor: string | null, limit: number): Prisma.Sql {
  return Prisma.sql`
    SELECT i."id" AS "invoiceId", i."bookingId", i."status" AS "invoiceStatus", b."status" AS "bookingStatus"
    FROM "Invoice" i
    INNER JOIN "Booking" b ON b."id" = i."bookingId"
    WHERE i."bookingId" IS NOT NULL
      ${cursor === null ? Prisma.empty : Prisma.sql`AND i."id" > ${cursor}`}
    ORDER BY i."id" ASC
    LIMIT ${limit}
  `;
}

function missingPersonSql(cursor: string | null, limit: number): Prisma.Sql {
  return Prisma.sql`
    SELECT ref."evidenceId", ref."entityId", ref."entityType", ref."referenceType", ref."referenceId", ref."personExists"
    FROM (
      SELECT ('Booking:' || b."id" || ':client') AS "evidenceId", b."id" AS "entityId", 'Booking' AS "entityType", 'client' AS "referenceType", b."clientId" AS "referenceId", c."id" IS NOT NULL AS "personExists"
      FROM "Booking" b LEFT JOIN "Client" c ON c."id" = b."clientId"
      UNION ALL
      SELECT ('Booking:' || b."id" || ':employee') AS "evidenceId", b."id", 'Booking', 'employee', b."employeeId", e."id" IS NOT NULL
      FROM "Booking" b LEFT JOIN "Employee" e ON e."id" = b."employeeId"
      UNION ALL
      SELECT ('Invoice:' || i."id" || ':client') AS "evidenceId", i."id", 'Invoice', 'client', i."clientId", c."id" IS NOT NULL
      FROM "Invoice" i LEFT JOIN "Client" c ON c."id" = i."clientId"
      UNION ALL
      SELECT ('Invoice:' || i."id" || ':employee') AS "evidenceId", i."id", 'Invoice', 'employee', i."employeeId", e."id" IS NOT NULL
      FROM "Invoice" i LEFT JOIN "Employee" e ON e."id" = i."employeeId"
    ) ref
    WHERE ${cursor === null ? Prisma.sql`TRUE` : Prisma.sql`ref."evidenceId" > ${cursor}`}
    ORDER BY ref."evidenceId" ASC
    LIMIT ${limit}
  `;
}

function intakeDuplicateSql(cursor: string | null, limit: number): Prisma.Sql {
  return Prisma.sql`
    SELECT ('IntakeResponse:' || "bookingId" || ':' || "formId") AS "evidenceId",
      "bookingId", "formId", array_agg("id" ORDER BY "id") AS "sourceIds", count(*)::int AS "currentCount"
    FROM "IntakeResponse"
    WHERE "supersededAt" IS NULL
    GROUP BY "bookingId", "formId"
    HAVING (${cursor === null ? Prisma.sql`TRUE` : Prisma.sql`('IntakeResponse:' || "bookingId" || ':' || "formId') > ${cursor}`})
    ORDER BY "evidenceId" ASC
    LIMIT ${limit}
  `;
}

function stalledOutboxSql(cursor: string | null, limit: number, cutoff: Date): Prisma.Sql {
  return Prisma.sql`
    SELECT "id", "aggregateId", "status", "createdAt"
    FROM "OutboxEvent"
    WHERE "publishedAt" IS NULL
      AND "status" IN ('PENDING', 'FAILED')
      AND "createdAt" < ${cutoff}
      AND (${cursor === null ? Prisma.sql`TRUE` : Prisma.sql`"id" > ${cursor}`})
    ORDER BY "id" ASC
    LIMIT ${limit}
  `;
}

export async function auditFinanceBookings(
  prisma: ReadPrisma,
  options: FinanceBookingsAuditOptions = {},
): Promise<FinanceBookingsAuditPage> {
  const batchSize = validatePositiveInteger(options.batchSize ?? DEFAULT_AUDIT_BATCH_SIZE, 'batchSize', 100);
  const stalledOutboxHours = validateHours(options.stalledOutboxHours ?? DEFAULT_STALLED_OUTBOX_HOURS);
  const cursors = { ...(options.cursors ?? {}) };
  const completedCategories = [...new Set(options.completedCategories ?? [])]
    .filter((category): category is AuditCategory => AUDIT_CATEGORIES.includes(category));
  const now = options.now ?? new Date();
  if (Number.isNaN(now.getTime())) fail('now must be a valid Date');
  const cutoff = new Date(now.getTime() - stalledOutboxHours * 60 * 60 * 1000);

  return prisma.$transaction(async (tx) => {
    const readTx = tx as unknown as RawReadTransaction;
    await readTx.$executeRaw(Prisma.sql`SET TRANSACTION READ ONLY`);
    const [identity] = await readTx.$queryRaw<IdentityRow[]>(Prisma.sql`
      SELECT current_database() AS database, current_schema() AS schema
    `);
    if (!identity?.database || !identity.schema) fail('Database identity query returned no row');

    // Keep queries sequential on the interactive transaction's single
    // connection. This makes the repeatable-read boundary and query evidence
    // unambiguous to operators and tests.
    const invoice = isCompleted(completedCategories, 'INVOICE_OVER_COLLECTION')
      ? { rows: [] as InvoiceOverCollectionRow[] } as CategoryPage<InvoiceOverCollectionRow> : await readCategory<InvoiceOverCollectionRow>(readTx, 'INVOICE_OVER_COLLECTION', categoryCursor(cursors, 'INVOICE_OVER_COLLECTION'), batchSize, invoiceOverCollectionSql);
    const payment = isCompleted(completedCategories, 'PAYMENT_REFUND_MISMATCH')
      ? { rows: [] as PaymentRefundMismatchRow[] } as CategoryPage<PaymentRefundMismatchRow> : await readCategory<PaymentRefundMismatchRow>(readTx, 'PAYMENT_REFUND_MISMATCH', categoryCursor(cursors, 'PAYMENT_REFUND_MISMATCH'), batchSize, paymentRefundMismatchSql);
    const status = isCompleted(completedCategories, 'INVOICE_BOOKING_STATUS_MISMATCH')
      ? { rows: [] as StatusMismatchRow[] } as CategoryPage<StatusMismatchRow> : await readCategory<StatusMismatchRow>(readTx, 'INVOICE_BOOKING_STATUS_MISMATCH', categoryCursor(cursors, 'INVOICE_BOOKING_STATUS_MISMATCH'), batchSize, statusMismatchSql);
    const person = isCompleted(completedCategories, 'MISSING_PERSON_REFERENCE')
      ? { rows: [] as MissingPersonRow[] } as CategoryPage<MissingPersonRow> : await readCategory<MissingPersonRow>(readTx, 'MISSING_PERSON_REFERENCE', categoryCursor(cursors, 'MISSING_PERSON_REFERENCE'), batchSize, missingPersonSql);
    const intake = isCompleted(completedCategories, 'INTAKE_CURRENT_DUPLICATE')
      ? { rows: [] as IntakeDuplicateRow[] } as CategoryPage<IntakeDuplicateRow> : await readCategory<IntakeDuplicateRow>(readTx, 'INTAKE_CURRENT_DUPLICATE', categoryCursor(cursors, 'INTAKE_CURRENT_DUPLICATE'), batchSize, intakeDuplicateSql);
    const outbox = isCompleted(completedCategories, 'STALLED_OUTBOX')
      ? { rows: [] as StalledOutboxRow[] } as CategoryPage<StalledOutboxRow> : await readCategory<StalledOutboxRow>(readTx, 'STALLED_OUTBOX', categoryCursor(cursors, 'STALLED_OUTBOX'), batchSize, (cursor, limit) => stalledOutboxSql(cursor, limit, cutoff));

    const findings: AuditFinding[] = [];
    for (const row of invoice.rows) {
      const invoiceTotal = parseHalalas(row.invoiceTotal);
      const grossSettled = parseHalalas(row.grossSettled);
      const refundedSettled = parseHalalas(row.refundedSettled);
      if (grossSettled - refundedSettled <= invoiceTotal) continue;
      findings.push({ category: 'INVOICE_OVER_COLLECTION', severity: 'REVIEW_REQUIRED',
        evidenceId: `Invoice:${row.invoiceId}`, entityId: row.invoiceId, invoiceId: row.invoiceId,
        ...(row.bookingId ? { bookingId: row.bookingId } : {}),
        ...(row.packagePurchaseId ? { packagePurchaseId: row.packagePurchaseId } : {}),
        reasonCode: 'NET_SETTLED_EXCEEDS_INVOICE_TOTAL', amountHalalas: invoiceTotal,
        grossSettledHalalas: grossSettled, refundedSettledHalalas: refundedSettled });
    }
    for (const row of payment.rows) {
      const recorded = parseHalalas(row.recordedRefunded);
      const completed = parseHalalas(row.completedRefunded);
      if (recorded === completed) continue;
      findings.push({ category: 'PAYMENT_REFUND_MISMATCH', severity: 'REVIEW_REQUIRED',
        evidenceId: `Payment:${row.paymentId}`, entityId: row.paymentId, paymentId: row.paymentId, invoiceId: row.invoiceId,
        reasonCode: 'RECORDED_REFUNDS_DIFFER_FROM_COMPLETED_REQUESTS',
        recordedRefundedHalalas: recorded, completedRefundedHalalas: completed,
        differenceHalalas: positiveDifference(recorded, completed) });
    }
    for (const row of status.rows) {
      if (row.invoiceStatus !== 'PAID' || row.bookingStatus !== 'DEPOSIT_PAID') continue;
      findings.push({ category: 'INVOICE_BOOKING_STATUS_MISMATCH', severity: 'REVIEW_REQUIRED',
        evidenceId: `Invoice:${row.invoiceId}`, entityId: row.bookingId, invoiceId: row.invoiceId, bookingId: row.bookingId,
        reasonCode: 'PAID_INVOICE_WITH_DEPOSIT_PAID_BOOKING' });
    }
    for (const row of person.rows) {
      if (row.personExists) continue;
      findings.push({ category: 'MISSING_PERSON_REFERENCE', severity: 'REVIEW_REQUIRED', evidenceId: row.evidenceId,
        entityId: row.entityId, referenceType: row.referenceType, referenceId: row.referenceId,
        reasonCode: `MISSING_${row.entityType.toUpperCase()}_${row.referenceType.toUpperCase()}_REFERENCE` });
    }
    for (const row of intake.rows) {
      if (Number(row.currentCount) <= 1) continue;
      findings.push({ category: 'INTAKE_CURRENT_DUPLICATE', severity: 'REVIEW_REQUIRED', evidenceId: row.evidenceId,
        entityId: row.bookingId, bookingId: row.bookingId, sourceIds: row.sourceIds,
        currentCount: Number(row.currentCount), reasonCode: 'MULTIPLE_CURRENT_RESPONSES_FOR_BOOKING_FORM' });
    }
    for (const row of outbox.rows) {
      findings.push({ category: 'STALLED_OUTBOX', severity: 'REVIEW_REQUIRED', evidenceId: `OutboxEvent:${row.id}`,
        entityId: row.aggregateId, reasonCode: `UNPUBLISHED_${row.status}_EVENT_PAST_THRESHOLD`, createdAt: isoDate(row.createdAt) });
    }

    const pages = [
      ['INVOICE_OVER_COLLECTION', invoice], ['PAYMENT_REFUND_MISMATCH', payment],
      ['INVOICE_BOOKING_STATUS_MISMATCH', status], ['MISSING_PERSON_REFERENCE', person],
      ['INTAKE_CURRENT_DUPLICATE', intake], ['STALLED_OUTBOX', outbox],
    ] as const;
    const counts = emptyCounts();
    const scanned = emptyCounts();
    const nextCursors: AuditCursor = { ...cursors };
    const nextCompletedCategories = new Set<AuditCategory>(completedCategories);
    for (const [category, page] of pages) {
      scanned[category] = page.rows.length;
      if (page.next) nextCursors[category] = page.next;
      else if (!isCompleted(completedCategories, category)) nextCompletedCategories.add(category);
    }
    for (const finding of findings) counts[finding.category] += 1;
    const allCategoriesExhausted = nextCompletedCategories.size === AUDIT_CATEGORIES.length;
    const freshRun = Object.keys(cursors).length === 0 && completedCategories.length === 0;
    const complete = freshRun && allCategoriesExhausted;
    const completion: AuditCompletion = complete ? 'FULL_FRESH_PASS'
      : freshRun ? 'PAGE_ONLY' : 'RESUMED_UNVERIFIED';
    findings.sort((left, right) => left.evidenceId.localeCompare(right.evidenceId) || left.category.localeCompare(right.category));
    return { schemaVersion: 1, ruleVersion: AUDIT_RULE_VERSION, database: identity.database, schema: identity.schema,
      generatedAt: now.toISOString(), stalledOutboxHours, batchSize, cursors, nextCursors,
      completedCategories, nextCompletedCategories: [...nextCompletedCategories].sort(), complete,
      completion, counts, scanned, totalFindings: findings.length, checksum: checksum(findings), findings };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 30_000 });
}

// Explicit aliases make the intended read-only API discoverable to operators
// without creating a second implementation.
export const createFinanceBookingsAudit = auditFinanceBookings;
export const createFinanceBookingsAuditPage = auditFinanceBookings;
