/**
 * One-off backfill for the invoice statement vs paid receipt split.
 *
 * Scans PAID / PARTIALLY_REFUNDED / REFUNDED invoices with no receipt
 * (`receiptIssuedAt IS NULL`) and classifies each one:
 *
 *   A   real receipt: legacy `pdfUrl` was generated at/after `paidAt`.
 *       -> adopt it (receiptPdfKey / receiptIssuedAt / receiptPaymentId).
 *   A2  class A, paid on/after 2026-09-25, but no 'finance.invoice.receipt.issued'
 *       outbox event and the booking is not a late entry: the receipt exists but
 *       was probably never emailed. Report only.
 *   B   stuck: `pdfUrl` was generated before `paidAt` (a statement, not a receipt).
 *       -> PAID only: IssueInvoiceReceiptHandler.issue(..., { deliver: false }),
 *          silently (no email). Refunded statuses are report only.
 *   C   PAID, no `pdfUrl`, total > 0. Report only.
 *
 * Invoices with a previous-receipt payment (receiptRecordedBy set) get no
 * receipt: they are SKIPped before A / A2 / B / C and listed in the report.
 *
 * Dry-run is the default and never writes. Money stays in integer halalas.
 *
 * Usage (from apps/backend):
 *   pnpm exec tsx scripts/finance/backfill-invoice-receipts.ts \
 *     --database-url-env=HISTORICAL_AUDIT_DATABASE_URL --dry-run
 *   pnpm exec tsx scripts/finance/backfill-invoice-receipts.ts \
 *     --database-url-env=HISTORICAL_AUDIT_DATABASE_URL --apply --confirm-database=<DB_NAME> \
 *     --confirm-storage=<MINIO_ENDPOINT[:PORT]>/finance-invoices
 *
 * The connection string is read from the NAMED env var, never from the app's
 * default DATABASE_URL. Apply mode needs an exact --confirm-database and
 * refuses shared or production-shaped database names. Apply also needs an
 * exact --confirm-storage equal to the MINIO_ENDPOINT[:MINIO_PORT]/bucket the
 * receipt issuer will upload to, and refuses production-shaped storage hosts
 * (e.g. files.sawaa.sa). Dry-run touches no storage. Class B constructs only
 * the receipt handler's dependencies (Prisma on the named database, renderer,
 * MinIO from MINIO_* env, CLS, transaction wrapper, inert event bus); it never
 * boots AppModule, so no queues, schedulers or bootstraps run.
 */

import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { decimalToHalalas } from '../../src/modules/finance/money.helper';
import { extractInvoicePdfKey, FINANCE_INVOICES_BUCKET_NAME } from '../../src/modules/finance/issue-invoice-receipt/invoice-pdf-key.helper';

export const RECEIPT_EMAIL_ERA_START = new Date('2026-09-25T00:00:00+03:00');
export const RECEIPT_ISSUED_EVENT_TYPE = 'finance.invoice.receipt.issued';
const RECEIPT_STATUSES = ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'] as const;

export interface CandidateInvoice {
  id: string;
  number: number;
  status: string;
  total: unknown;
  paidAt: Date | null;
  pdfUrl: string | null;
  pdfGeneratedAt: Date | null;
  bookingId: string | null;
}

export interface InvoiceFacts {
  /** Latest payment in COMPLETED / PARTIALLY_REFUNDED / REFUNDED, or null. */
  latestPaymentId: string | null;
  /** True when any payment on the invoice was recorded as a previous receipt (receiptRecordedBy set). */
  isPreviousReceipt: boolean;
  hasReceiptOutboxEvent: boolean;
  bookingLateEntry: boolean;
}

const PREVIOUS_RECEIPT_REASON = 'previous receipt invoice';

export type Classification =
  | { kind: 'A'; key: string; issuedAt: Date; paymentId: string; unsent: boolean }
  | { kind: 'B'; paymentId: string; canIssue: boolean }
  | { kind: 'C' }
  | { kind: 'SKIP'; reason: string };

/** Pure classification of one candidate invoice. */
export function classifyInvoice(inv: CandidateInvoice, facts: InvoiceFacts): Classification {
  if (facts.isPreviousReceipt) return { kind: 'SKIP', reason: PREVIOUS_RECEIPT_REASON };
  if (inv.pdfUrl) {
    if (!inv.paidAt || !inv.pdfGeneratedAt) return { kind: 'SKIP', reason: 'undated pdf or paidAt' };
    if (!facts.latestPaymentId) return { kind: 'SKIP', reason: 'no completed payment' };
    if (inv.pdfGeneratedAt >= inv.paidAt) {
      const unsent =
        inv.paidAt >= RECEIPT_EMAIL_ERA_START &&
        !facts.hasReceiptOutboxEvent &&
        !facts.bookingLateEntry;
      return {
        kind: 'A',
        key: extractInvoicePdfKey(inv.pdfUrl),
        issuedAt: inv.pdfGeneratedAt,
        paymentId: facts.latestPaymentId,
        unsent,
      };
    }
    return { kind: 'B', paymentId: facts.latestPaymentId, canIssue: inv.status === 'PAID' };
  }
  if (
    inv.status === 'PAID' &&
    decimalToHalalas(inv.total as never) > 0
  ) {
    return { kind: 'C' };
  }
  return { kind: 'SKIP', reason: 'no receipt expected' };
}

export interface BackfillDeps {
  listCandidates(): Promise<CandidateInvoice[]>;
  loadFacts(inv: CandidateInvoice): Promise<InvoiceFacts>;
  /** Guarded on receiptIssuedAt null; resolves true when a row was updated. */
  adoptReceipt(
    inv: CandidateInvoice,
    data: { key: string; issuedAt: Date; paymentId: string },
  ): Promise<boolean>;
  issueSilently(invoiceId: string, paymentId: string): Promise<void>;
}

export interface BackfillReport {
  dryRun: boolean;
  scanned: number;
  adopted: string[]; // class A ids (adopted, or would be)
  unsent: string[]; // A2 numbers
  stuckIssued: string[]; // class B ids (issued, or would be)
  stuckReportOnly: string[]; // class B on refunded statuses
  missingReceipt: string[]; // class C numbers
  previousReceipt: string[]; // skipped: previous-receipt invoices (any class)
  skipped: number;
  errors: string[];
}

export async function runBackfill(
  deps: BackfillDeps,
  options: { apply: boolean },
): Promise<BackfillReport> {
  const candidates = await deps.listCandidates();
  const report: BackfillReport = {
    dryRun: !options.apply,
    scanned: candidates.length,
    adopted: [],
    unsent: [],
    stuckIssued: [],
    stuckReportOnly: [],
    missingReceipt: [],
    previousReceipt: [],
    skipped: 0,
    errors: [],
  };
  for (const inv of candidates) {
    try {
      const c = classifyInvoice(inv, await deps.loadFacts(inv));
      if (c.kind === 'A') {
        if (options.apply) {
          const updated = await deps.adoptReceipt(inv, {
            key: c.key,
            issuedAt: c.issuedAt,
            paymentId: c.paymentId,
          });
          if (!updated) {
            report.skipped += 1; // receipted concurrently
            continue;
          }
        }
        report.adopted.push(`#${inv.number} (${inv.id})`);
        if (c.unsent) report.unsent.push(`#${inv.number} (${inv.id})`);
      } else if (c.kind === 'B') {
        if (!c.canIssue) {
          report.stuckReportOnly.push(`#${inv.number} (${inv.id}) ${inv.status}`);
          continue;
        }
        if (options.apply) await deps.issueSilently(inv.id, c.paymentId);
        report.stuckIssued.push(`#${inv.number} (${inv.id})`);
      } else if (c.kind === 'C') {
        report.missingReceipt.push(`#${inv.number} (${inv.id})`);
      } else {
        report.skipped += 1;
        if (c.reason === PREVIOUS_RECEIPT_REASON) {
          report.previousReceipt.push(`#${inv.number} (${inv.id})`);
        }
      }
    } catch (error) {
      report.errors.push(`#${inv.number} (${inv.id}): ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }
  return report;
}

export function formatReport(r: BackfillReport): string {
  const list = (label: string, items: string[]) => [
    `${label}: ${items.length}`,
    ...items.map((i) => `  - ${i}`),
  ];
  return [
    `${r.dryRun ? '[dry run] ' : '[applied] '}invoices scanned: ${r.scanned}`,
    ...list(`A real receipts ${r.dryRun ? 'to adopt' : 'adopted'}`, r.adopted),
    ...list('A2 receipt likely never emailed (report only)', r.unsent),
    ...list(`B stuck ${r.dryRun ? 'to issue silently' : 'issued silently'}`, r.stuckIssued),
    ...list('B stuck on refunded statuses (report only)', r.stuckReportOnly),
    ...list('C paid without any pdf (report only)', r.missingReceipt),
    ...list('skipped: previous-receipt invoices (no receipt by rule)', r.previousReceipt),
    `skipped: ${r.skipped}`,
    ...list('errors', r.errors),
  ].join('\n');
}

// ─── CLI ─────────────────────────────────────────────────────────────────

export interface CliOptions {
  apply: boolean;
  databaseUrlEnv: string;
  confirmDatabase?: string;
  confirmStorage?: string;
}

function fail(message: string): never {
  throw new Error(message);
}

export function parseCliArgs(args: readonly string[]): CliOptions {
  let apply = false;
  let dryRun = false;
  let databaseUrlEnv: string | undefined;
  let confirmDatabase: string | undefined;
  let confirmStorage: string | undefined;
  for (const arg of args) {
    if (arg === '--apply') {
      if (apply || dryRun) fail('--apply cannot be combined with --dry-run or repeated');
      apply = true;
    } else if (arg === '--dry-run') {
      if (apply || dryRun) fail('--dry-run cannot be combined with --apply or repeated');
      dryRun = true;
    } else if (arg.startsWith('--database-url-env=')) {
      databaseUrlEnv = arg.slice('--database-url-env='.length).trim();
    } else if (arg.startsWith('--confirm-database=')) {
      confirmDatabase = arg.slice('--confirm-database='.length).trim();
    } else if (arg.startsWith('--confirm-storage=')) {
      confirmStorage = arg.slice('--confirm-storage='.length).trim();
    } else {
      fail(`Unknown argument: ${arg}`);
    }
  }
  if (!databaseUrlEnv) fail('--database-url-env=<ENV_VAR_NAME> is required');
  if (databaseUrlEnv === 'DATABASE_URL') fail('--database-url-env must not be DATABASE_URL');
  if (apply && !confirmDatabase) fail('--apply requires --confirm-database=<DB_NAME>');
  if (!apply && confirmDatabase) fail('--confirm-database requires --apply');
  if (apply && !confirmStorage) fail('--apply requires --confirm-storage=<MINIO_ENDPOINT[:PORT]>/<BUCKET>');
  if (!apply && confirmStorage) fail('--confirm-storage requires --apply');
  return { apply, databaseUrlEnv, confirmDatabase, confirmStorage };
}

const PROTECTED_NAME_PATTERNS = [
  /^(?:sawaa|sawa)(?:[-_]?)(?:dev|prod(?:uction)?|stage|staging|live|primary)?(?:[-_].*)?$/i,
  /^postgres(?:[-_].*)?$/i,
];

export function resolveDatabaseUrl(options: CliOptions, env: NodeJS.ProcessEnv): string {
  const raw = env[options.databaseUrlEnv]?.trim();
  if (!raw) fail(`${options.databaseUrlEnv} is not set`);
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return fail('the named database URL must be a valid postgres connection string');
  }
  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
    fail('the named database URL must use the postgres or postgresql protocol');
  }
  const name = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
  if (!name) fail('the named database URL must include a database name');
  if (options.apply) {
    if (name !== options.confirmDatabase) {
      fail(`--confirm-database must exactly match the database name "${name}"`);
    }
    if (PROTECTED_NAME_PATTERNS.some((p) => p.test(name))) {
      fail(`Refusing to write against database "${name}" — it looks like a shared or production database.`);
    }
  }
  return raw;
}

const PROTECTED_STORAGE_HOST = /(^|[.-])sawaa?([.-]|$)/i;

/**
 * Apply mode only: the storage target the receipt issuer will upload to
 * (`MINIO_ENDPOINT[:MINIO_PORT]/finance-invoices`). Must equal --confirm-storage
 * and must not look like a shared or production host. Returns null in dry-run.
 */
export function resolveStorageTarget(options: CliOptions, env: NodeJS.ProcessEnv): string | null {
  if (!options.apply) return null;
  const host = env.MINIO_ENDPOINT?.trim();
  if (!host) fail('MINIO_ENDPOINT is not set');
  const port = env.MINIO_PORT?.trim();
  const target = `${host}${port ? `:${port}` : ''}/${FINANCE_INVOICES_BUCKET_NAME}`;
  if (target !== options.confirmStorage) {
    fail(`--confirm-storage must exactly match the receipt storage target "${target}"`);
  }
  if (PROTECTED_STORAGE_HOST.test(host) || PROTECTED_NAME_PATTERNS.some((p) => p.test(host.split('.')[0]))) {
    fail(`Refusing to upload to storage "${target}" — it looks like a shared or production bucket.`);
  }
  return target;
}

function buildPrismaDeps(
  prisma: PrismaClient,
  issueSilently: BackfillDeps['issueSilently'],
): BackfillDeps {
  return {
    listCandidates: () =>
      prisma.invoice.findMany({
        where: { status: { in: [...RECEIPT_STATUSES] }, receiptIssuedAt: null },
        select: {
          id: true, number: true, status: true, total: true,
          paidAt: true, pdfUrl: true, pdfGeneratedAt: true, bookingId: true,
        },
        orderBy: { number: 'asc' },
      }),
    async loadFacts(inv) {
      const payments = await prisma.payment.findMany({
        where: { invoiceId: inv.id, status: { in: ['COMPLETED', 'PARTIALLY_REFUNDED', 'REFUNDED'] } },
        select: { id: true },
        orderBy: [{ processedAt: 'desc' }, { createdAt: 'desc' }],
      });
      const [previousReceipt, outbox, booking] = await Promise.all([
        prisma.payment.findFirst({
          where: { invoiceId: inv.id, receiptRecordedBy: { not: null } },
          select: { id: true },
        }),
        prisma.outboxEvent.findFirst({
          where: { aggregateId: inv.id, eventType: RECEIPT_ISSUED_EVENT_TYPE },
          select: { id: true },
        }),
        inv.bookingId
          ? prisma.booking.findFirst({ where: { id: inv.bookingId }, select: { lateEntryRecordedAt: true } })
          : null,
      ]);
      return {
        latestPaymentId: payments[0]?.id ?? null,
        isPreviousReceipt: !!previousReceipt,
        hasReceiptOutboxEvent: !!outbox,
        bookingLateEntry: !!booking?.lateEntryRecordedAt,
      };
    },
    async adoptReceipt(inv, data) {
      const { count } = await prisma.invoice.updateMany({
        where: { id: inv.id, receiptIssuedAt: null },
        data: {
          receiptPdfKey: data.key,
          receiptIssuedAt: data.issuedAt,
          receiptPaymentId: data.paymentId,
        },
      });
      return count > 0;
    },
    issueSilently,
  };
}

/**
 * A hand-built MinioService never runs Nest's onModuleInit, so the finance
 * buckets are not provisioned. Run it explicitly (it only logs on failure),
 * then verify the bucket really exists so apply mode fails before any write.
 */
export async function ensureReceiptBucket(
  storage: {
    onModuleInit(): Promise<void>;
    bucketExists(bucket: string): Promise<boolean>;
  },
  bucket: string,
): Promise<void> {
  await storage.onModuleInit();
  let exists = false;
  try {
    exists = await storage.bucketExists(bucket);
  } catch (error) {
    throw new Error(
      `storage preflight failed: cannot verify bucket "${bucket}" (${error instanceof Error ? error.message : 'unknown error'})`,
    );
  }
  if (!exists) {
    throw new Error(`storage preflight failed: bucket "${bucket}" is unavailable`);
  }
}

/** Minimal wiring for IssueInvoiceReceiptHandler.issue(): no AppModule, queues or schedulers. */
export async function createReceiptIssuer(
  databaseUrl: string,
  env: NodeJS.ProcessEnv,
): Promise<{ issue: BackfillDeps['issueSilently']; close(): Promise<void> }> {
  const [{ AsyncLocalStorage }, { ClsService }, { ConfigService }] = await Promise.all([
    import('async_hooks'),
    import('nestjs-cls'),
    import('@nestjs/config'),
  ]);
  const [{ PrismaService }, { RlsTransactionService }, { MinioService, FINANCE_INVOICES_BUCKET }, { InvoicePdfRendererService }, { IssueInvoiceReceiptHandler }] =
    await Promise.all([
      import('../../src/infrastructure/database/prisma.service'),
      import('../../src/common/database/rls-transaction'),
      import('../../src/infrastructure/storage/minio.service'),
      import('../../src/modules/finance/issue-invoice-receipt/invoice-pdf-renderer.service'),
      import('../../src/modules/finance/issue-invoice-receipt/issue-invoice-receipt.handler'),
    ]);
  // PrismaService reads DATABASE_URL at construction: point it at the named database.
  process.env.DATABASE_URL = databaseUrl;
  const cls = new ClsService(new AsyncLocalStorage());
  const prisma = new PrismaService(undefined, cls);
  await prisma.$connect();
  const storage = new MinioService(new ConfigService(env));
  try {
    await ensureReceiptBucket(storage, FINANCE_INVOICES_BUCKET);
  } catch (error) {
    await prisma.$disconnect().catch(() => undefined);
    throw error;
  }
  const handler = new IssueInvoiceReceiptHandler(
    prisma,
    new InvoicePdfRendererService(),
    storage,
    // issue() never publishes; subscribe/publish are not reachable here.
    {} as never,
    cls,
    new RlsTransactionService(prisma),
  );
  return {
    issue: (invoiceId, paymentId) => handler.issue(invoiceId, paymentId, { deliver: false }),
    close: () => prisma.$disconnect(),
  };
}

async function main(): Promise<void> {
  try {
    const options = parseCliArgs(process.argv.slice(2));
    const databaseUrl = resolveDatabaseUrl(options, process.env);
    resolveStorageTarget(options, process.env);
    const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
    let issuer: Awaited<ReturnType<typeof createReceiptIssuer>> | undefined;
    try {
      await prisma.$connect();
      // Apply mode: verify storage up front so a missing bucket fails before any write.
      if (options.apply) issuer = await createReceiptIssuer(databaseUrl, process.env);
      const issueSilently: BackfillDeps['issueSilently'] = async (invoiceId, paymentId) => {
        // Built lazily, only when a class B write is needed.
        issuer ??= await createReceiptIssuer(databaseUrl, process.env);
        await issuer.issue(invoiceId, paymentId);
      };
      const report = await runBackfill(buildPrismaDeps(prisma, issueSilently), { apply: options.apply });
      console.log(formatReport(report));
      if (report.errors.length > 0) process.exitCode = 1;
    } finally {
      await issuer?.close().catch(() => undefined);
      await prisma.$disconnect().catch(() => undefined);
    }
  } catch (error) {
    console.error(`invoice receipt backfill failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    process.exitCode = 1;
  }
}

if (require.main === module) void main();
