/**
 * Historical transition — Task 1 (remaining half) of the packages-phase-2
 * refund-visibility plan:
 * docs/superpowers/plans/2026-09-13-packages-phase-2-refund-visibility.md
 *
 * WHY this script exists
 * ───────────────────────
 * `PackageRefundEvent` is an append-only ledger. Once the refund handler
 * (Task 2, a separate change) starts writing to it, every future manual
 * refund gets one durable `LIVE` row. Everything that happened BEFORE the
 * ledger existed has no such row — the only surviving trace is the
 * cumulative `PackagePurchase.refundAmount` field plus whatever
 * `RefundRequest` rows happen to still exist. This script reconstructs as
 * much per-event history as the data honestly supports (an exact amount on
 * an exact date), and folds everything it cannot date into one explicit
 * "legacy aggregate" event per purchase — it never invents a date, never
 * invents a breakdown, and never mutates a row once written.
 *
 * See the plan's "Agreed contracts and historical rules" section for the
 * full spec. `planPurchase` below is the worked residual/idempotency shape
 * from that section, kept deliberately pure so it can be exercised with
 * fixtures without a database.
 *
 * Usage
 * ─────
 *   pnpm --filter=backend exec tsx scripts/backfill-package-refund-events.ts \
 *     --database-url-env=HISTORICAL_AUDIT_DATABASE_URL --dry-run
 *
 * The database connection is NEVER hardcoded and NEVER the app's default
 * `DATABASE_URL` — the caller must name an explicitly protected environment
 * variable that holds the connection string. Write mode requires both
 * `--apply` and an exact `--confirm-database=<name>` acknowledgement, and
 * refuses shared or production-shaped database names.
 * This script does not claim to have migrated real data — running it in
 * write mode against real history is a separate, explicitly authorized step
 * outside this task.
 */

import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  PackagePurchaseStatus,
  PackageRefundEventSource,
  PackageRefundType,
  Prisma,
  PrismaClient,
  RefundStatus,
} from '@prisma/client';
import { decimalToHalalas } from '../src/modules/finance/money.helper';
import {
  type BackfillFinding,
  type CompletedRequestRow,
  type ExistingEventRow,
  type LockedPurchaseRow,
  type PurchasePlan,
  planPurchase,
} from '../src/modules/finance/package-refund-reconciliation';

export type {
  BackfillFinding,
  CompletedRequestRow,
  ExistingEventRow,
  LockedPurchaseRow,
  PurchasePlan,
} from '../src/modules/finance/package-refund-reconciliation';
export { planPurchase } from '../src/modules/finance/package-refund-reconciliation';

export interface BackfillSummary {
  purchasesConsidered: number;
  importedRequestCount: number;
  aggregateCount: number;
  residualHalalas: number;
  undatedPurchaseCount: number;
  findings: BackfillFinding[];
}

// ─── Database access (thin — all decision logic lives in planPurchase) ──

/** Minimal shape `runBackfill` needs from a transaction client. Kept narrow so tests can supply a plain fixture object. */
export interface TransitionTxClient {
  $queryRaw<T = unknown>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T>;
  packageRefundEvent: {
    findMany(args: unknown): Promise<ExistingEventRow[]>;
    create(args: unknown): Promise<unknown>;
  };
  refundRequest: {
    findMany(args: unknown): Promise<CompletedRequestRow[]>;
  };
}

/** Minimal shape `runBackfill` needs from the top-level Prisma client. */
export interface TransitionPrismaClient {
  packagePurchase: {
    findMany(args: unknown): Promise<Array<{ id: string }>>;
  };
  $transaction<T>(
    fn: (tx: TransitionTxClient) => Promise<T>,
    options?: { isolationLevel?: Prisma.TransactionIsolationLevel },
  ): Promise<T>;
}

/**
 * Candidates: purchases with positive cumulative refundAmount, plus every
 * previously visible terminal zero-money purchase (status REFUNDED,
 * refundedAt known or not). This is a plain read — no lock — the
 * authoritative row is re-read FOR UPDATE per purchase afterwards.
 */
async function selectCandidatePurchaseIds(prisma: TransitionPrismaClient): Promise<string[]> {
  const rows = await prisma.packagePurchase.findMany({
    where: {
      OR: [{ refundAmount: { gt: 0 } }, { status: PackagePurchaseStatus.REFUNDED }],
    },
    select: { id: true },
    orderBy: { id: 'asc' },
  });
  return rows.map((row) => row.id);
}

async function lockPurchaseRow(
  tx: TransitionTxClient,
  purchaseId: string,
): Promise<LockedPurchaseRow | null> {
  const rows = await tx.$queryRaw<LockedPurchaseRow[]>`
    SELECT id, status, "refundAmount", "refundedAt"
    FROM "PackagePurchase"
    WHERE id = ${purchaseId}
    FOR UPDATE`;
  return rows[0] ?? null;
}

async function readPurchaseRow(
  tx: TransitionTxClient,
  purchaseId: string,
): Promise<LockedPurchaseRow | null> {
  const rows = await tx.$queryRaw<LockedPurchaseRow[]>`
    SELECT id, status, "refundAmount", "refundedAt"
    FROM "PackagePurchase"
    WHERE id = ${purchaseId}`;
  return rows[0] ?? null;
}

async function loadExistingEvents(
  tx: TransitionTxClient,
  purchaseId: string,
): Promise<ExistingEventRow[]> {
  return tx.packageRefundEvent.findMany({
    where: { purchaseId },
    select: { id: true, source: true, amount: true, sourceRefundRequestId: true },
  });
}

/** Completed requests linked to this purchase via its invoice — requests with no package invoice never reach here, so their amount naturally stays folded into the residual instead of being subtracted twice. */
async function loadCompletedRequests(
  tx: TransitionTxClient,
  purchaseId: string,
): Promise<CompletedRequestRow[]> {
  return tx.refundRequest.findMany({
    where: { status: RefundStatus.COMPLETED, invoice: { packagePurchaseId: purchaseId } },
    select: { id: true, amount: true, processedAt: true },
  });
}

async function applyPlan(
  tx: TransitionTxClient,
  plan: Extract<PurchasePlan, { kind: 'ready' }>,
  dryRun: boolean,
): Promise<void> {
  if (dryRun) return; // dry-run computes and reports only — no writes, ever.

  for (const request of plan.exactRequests) {
    await tx.packageRefundEvent.create({
      data: {
        purchaseId: plan.purchaseId,
        amount: request.amount,
        cumulativeRefundAmount: null,
        source: PackageRefundEventSource.LEGACY_REQUEST,
        refundType: PackageRefundType.UNKNOWN,
        occurredAt: request.processedAt,
        notes: `Historical refund reconstructed from RefundRequest ${request.id}.`,
        sourceRefundRequestId: request.id,
      },
    });
  }

  if (plan.createAggregate) {
    await tx.packageRefundEvent.create({
      data: {
        purchaseId: plan.purchaseId,
        amount: plan.residual,
        cumulativeRefundAmount: null,
        source: PackageRefundEventSource.LEGACY_AGGREGATE,
        refundType: PackageRefundType.UNKNOWN,
        occurredAt: plan.aggregateOccurredAt,
        notes: plan.aggregateNotes,
        legacyAggregateKey: `purchase:${plan.purchaseId}:legacy-residual`,
      },
    });
  }
}

/**
 * Runs the full transition. Each candidate purchase is processed in its own
 * transaction under its own `FOR UPDATE` lock — a failure or finding on one
 * purchase never blocks the rest, and two purchases never contend for the
 * same lock. Purchases are processed sequentially (not in parallel) so
 * output order is stable and no two transactions can deadlock against each
 * other for unrelated purchases.
 */
export async function runBackfill(
  prisma: TransitionPrismaClient,
  options: { dryRun: boolean },
): Promise<BackfillSummary> {
  const candidateIds = await selectCandidatePurchaseIds(prisma);
  const summary: BackfillSummary = {
    purchasesConsidered: candidateIds.length,
    importedRequestCount: 0,
    aggregateCount: 0,
    residualHalalas: 0,
    undatedPurchaseCount: 0,
    findings: [],
  };

  for (const purchaseId of candidateIds) {
    await prisma.$transaction(async (tx) => {
      // A dry run must remain compatible with a read-only database
      // transaction: FOR UPDATE is a write-intent lock and is rejected by
      // PostgreSQL in READ ONLY mode. The apply path takes the lock.
      const purchase = options.dryRun
        ? await readPurchaseRow(tx, purchaseId)
        : await lockPurchaseRow(tx, purchaseId);
      if (!purchase) return; // vanished between selection and lock — nothing to represent

      const [existing, completedRequests] = await Promise.all([
        loadExistingEvents(tx, purchaseId),
        loadCompletedRequests(tx, purchaseId),
      ]);

      const plan = planPurchase(purchase, existing, completedRequests);
      if (plan.kind === 'finding') {
        summary.findings.push({ purchaseId: plan.purchaseId, reason: plan.reason });
        return;
      }

      summary.importedRequestCount += plan.exactRequests.length;
      if (plan.createAggregate) {
        summary.aggregateCount += 1;
        summary.residualHalalas += decimalToHalalas(plan.residual);
        if (!plan.aggregateOccurredAt) summary.undatedPurchaseCount += 1;
      }

      await applyPlan(tx, plan, options.dryRun);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  return summary;
}

// ─── CLI ─────────────────────────────────────────────────────────────────

export interface BackfillCliOptions {
  dryRun: boolean;
  databaseUrlEnv: string;
  confirmDatabase?: string;
}

const USAGE = `Usage:
  backfill-package-refund-events --database-url-env=<ENV_VAR_NAME> [--dry-run]
  backfill-package-refund-events --database-url-env=<ENV_VAR_NAME> --apply --confirm-database=<DB_NAME>

The database connection is never hardcoded and never the app's default
DATABASE_URL — name an explicitly protected environment variable that holds
the connection string, e.g.:

  --database-url-env=HISTORICAL_AUDIT_DATABASE_URL

Dry-run is the default and never writes. Apply mode requires both --apply and
an exact --confirm-database=<DB_NAME>; shared or production-shaped names are
always refused.`;

export class BackfillCliHelpRequested extends Error {
  constructor() {
    super(USAGE);
    this.name = 'BackfillCliHelpRequested';
  }
}

function fail(message: string): never {
  throw new Error(message);
}

const DATABASE_URL_ENV_FLAG = '--database-url-env=';

export function parseBackfillCliArgs(args: readonly string[]): BackfillCliOptions {
  let dryRun = true;
  let apply = false;
  let dryRunExplicit = false;
  let databaseUrlEnv: string | undefined;
  let confirmDatabase: string | undefined;

  for (const arg of args) {
    if (arg === '--help' || arg === '-h') throw new BackfillCliHelpRequested();
    if (arg === '--dry-run') {
      if (apply || dryRunExplicit) fail('--dry-run cannot be specified with --apply or more than once');
      dryRunExplicit = true;
      dryRun = true;
      continue;
    }
    if (arg === '--apply') {
      if (apply || dryRunExplicit) fail('--apply cannot be specified with --dry-run or more than once');
      apply = true;
      dryRun = false;
      continue;
    }
    if (arg.startsWith(DATABASE_URL_ENV_FLAG)) {
      if (databaseUrlEnv) fail('--database-url-env may be specified only once');
      databaseUrlEnv = arg.slice(DATABASE_URL_ENV_FLAG.length).trim();
      if (!databaseUrlEnv) fail('--database-url-env requires a value, e.g. --database-url-env=HISTORICAL_AUDIT_DATABASE_URL');
      continue;
    }
    if (arg.startsWith('--confirm-database=')) {
      if (confirmDatabase) fail('--confirm-database may be specified only once');
      confirmDatabase = arg.slice('--confirm-database='.length).trim();
      if (!confirmDatabase) fail('--confirm-database requires a database name');
      continue;
    }
    fail(`Unknown argument: ${arg}`);
  }

  if (!databaseUrlEnv) fail('--database-url-env=<ENV_VAR_NAME> is required — this transition never uses a default or hardcoded database');
  if (databaseUrlEnv === 'DATABASE_URL') {
    fail("--database-url-env must not be DATABASE_URL — the transition never runs against the app's default connection");
  }
  if (apply && !confirmDatabase) {
    fail('--apply requires --confirm-database=<DB_NAME>');
  }
  if (!apply && confirmDatabase) {
    fail('--confirm-database requires --apply');
  }

  return { dryRun, databaseUrlEnv, confirmDatabase };
}

// Names that must never be written to by this script, even if an operator
// points --database-url-env at them by mistake. Keep dedicated transition
// names (for example sawaa_e2e) available, but refuse common environment
// suffixes and production aliases.
const PROTECTED_DATABASE_NAMES = new Set(['sawaa_dev', 'sawaa_prod', 'sawaa', 'postgres']);
const PROTECTED_DATABASE_NAME_PATTERNS = [
  /^(?:sawaa|sawa)(?:[-_]?)(?:dev|prod(?:uction)?|stage|staging|live|primary)(?:[-_].*)?$/i,
  /^postgres(?:[-_].*)?$/i,
];

function isProtectedDatabaseName(databaseName: string): boolean {
  return (
    PROTECTED_DATABASE_NAMES.has(databaseName.toLowerCase()) ||
    PROTECTED_DATABASE_NAME_PATTERNS.some((pattern) => pattern.test(databaseName))
  );
}

function databaseNameFromUrl(databaseUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    fail('the named database URL must be a valid postgres connection string');
  }
  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
    fail('the named database URL must use the postgres or postgresql protocol');
  }
  const name = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
  if (!name) fail('the named database URL must include a database name');
  return name;
}

export function resolveDatabaseUrl(
  options: BackfillCliOptions,
  environment: NodeJS.ProcessEnv,
): string {
  const raw = environment[options.databaseUrlEnv]?.trim();
  if (!raw) fail(`${options.databaseUrlEnv} is not set`);
  const databaseName = databaseNameFromUrl(raw);
  if (!options.dryRun) {
    if (!options.confirmDatabase) {
      fail('write mode requires --confirm-database=<DB_NAME>');
    }
    if (databaseName !== options.confirmDatabase) {
      fail(`--confirm-database must exactly match the database name "${databaseName}"`);
    }
  }
  if (!options.dryRun && isProtectedDatabaseName(databaseName)) {
    fail(
      `Refusing to write against database "${databaseName}" — it looks like a shared or production database. Point --database-url-env at a dedicated transition database instead.`,
    );
  }
  return raw;
}

function formatSummary(summary: BackfillSummary, dryRun: boolean): string {
  const lines = [
    `${dryRun ? '[dry run] ' : ''}purchases considered: ${summary.purchasesConsidered}`,
    `imported request events: ${summary.importedRequestCount}`,
    `legacy aggregates: ${summary.aggregateCount}`,
    `residual halalas represented by aggregates: ${summary.residualHalalas}`,
    `undated purchases: ${summary.undatedPurchaseCount}`,
    `reconciliation findings: ${summary.findings.length}`,
  ];
  for (const finding of summary.findings) {
    lines.push(`  - ${finding.purchaseId}: ${finding.reason}`);
  }
  return lines.join('\n');
}

async function main(): Promise<void> {
  try {
    const options = parseBackfillCliArgs(process.argv.slice(2));
    const databaseUrl = resolveDatabaseUrl(options, process.env);
    const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
    try {
      await prisma.$connect();
      const summary = await runBackfill(prisma as unknown as TransitionPrismaClient, {
        dryRun: options.dryRun,
      });
      console.log(formatSummary(summary, options.dryRun));
      if (summary.findings.length > 0) process.exitCode = 1;
    } finally {
      await prisma.$disconnect().catch(() => undefined);
    }
  } catch (error) {
    if (error instanceof BackfillCliHelpRequested) {
      console.log(error.message);
      return;
    }
    console.error(`backfill transition failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    process.exitCode = 1;
  }
}

if (require.main === module) void main();
