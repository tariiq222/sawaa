import { readFile } from 'node:fs/promises';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import {
  hashLegacyPayload,
  validateLegacyBundle,
} from '../modules/ops/legacy-import/legacy-import.bundle';
import {
  buildLegacyImportPlan,
  loadTargetSnapshot,
} from '../modules/ops/legacy-import/legacy-import.planner';
import {
  serializeSafeLegacyImportReport,
  type SafeLegacyImportReport,
} from '../modules/ops/legacy-import/legacy-import.report';
import { applyLegacyImportPlan } from '../modules/ops/legacy-import/legacy-import.writer';
import {
  assertLegacyImportAudit,
  collectLegacyImportAudit,
} from '../modules/ops/legacy-import/legacy-import.audit';

const FROZEN_CUTOVER = '2026-08-11T20:54:55Z';
const APPLY_CONFIRMATION = 'LEGACY-BOOKNETIC-TENANT-6-20260811';

export interface LegacyImportCliOptions {
  mode: 'dry-run' | 'apply';
  bundlePath: string;
  cutoverAt: string;
  expectedDatabase?: string;
  expectedBundleSha256?: string;
  environment?: 'local' | 'production';
  confirmation?: string;
}

function requiredValue(args: readonly string[], index: number, name: string): string {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value`);
  return value;
}

export function parseLegacyImportCliOptions(
  args: readonly string[],
): LegacyImportCliOptions {
  const values = new Map<string, string>();
  let mode: 'dry-run' | 'apply' = 'dry-run';
  const valueOptions = new Set([
    '--bundle',
    '--cutover-at',
    '--expected-database',
    '--expected-bundle-sha256',
    '--environment',
    '--confirmation',
  ]);
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    if (arg === '--') continue;
    if (arg === '--apply') {
      mode = 'apply';
      continue;
    }
    if (!valueOptions.has(arg)) throw new Error(`unknown argument: ${arg}`);
    if (values.has(arg)) throw new Error(`duplicate argument: ${arg}`);
    values.set(arg, requiredValue(args, index, arg));
    index += 1;
  }
  const bundlePath = values.get('--bundle');
  const cutoverAt = values.get('--cutover-at');
  if (!bundlePath) throw new Error('--bundle is required');
  if (!cutoverAt) throw new Error('--cutover-at is required');
  if (cutoverAt !== FROZEN_CUTOVER) {
    throw new Error(`cutover must be exactly ${FROZEN_CUTOVER}`);
  }
  const environment = values.get('--environment');
  if (environment && environment !== 'local' && environment !== 'production') {
    throw new Error('--environment must be local or production');
  }
  const expectedBundleSha256 = values.get('--expected-bundle-sha256');
  if (expectedBundleSha256 && !/^[a-f0-9]{64}$/i.test(expectedBundleSha256)) {
    throw new Error('--expected-bundle-sha256 must be a SHA-256 hash');
  }
  return {
    mode,
    bundlePath,
    cutoverAt,
    expectedDatabase: values.get('--expected-database'),
    expectedBundleSha256: expectedBundleSha256?.toLowerCase(),
    environment: environment as 'local' | 'production' | undefined,
    confirmation: values.get('--confirmation'),
  };
}

function databaseName(databaseUrl: string): string {
  const parsed = new URL(databaseUrl);
  const name = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  if (!name) throw new Error('DATABASE_URL has no database name');
  return name;
}

export function validateLegacyImportTarget(
  options: LegacyImportCliOptions,
  databaseUrl: string,
): string {
  const parsed = new URL(databaseUrl);
  const targetDatabase = databaseName(databaseUrl);
  if (options.mode === 'dry-run') return targetDatabase;
  if (!options.expectedDatabase) throw new Error('--expected-database is required for apply');
  if (targetDatabase !== options.expectedDatabase) {
    throw new Error('target database name does not match --expected-database');
  }
  if (!options.expectedBundleSha256) {
    throw new Error('--expected-bundle-sha256 is required for apply');
  }
  if (!options.environment) throw new Error('--environment is required for apply');
  if (options.confirmation !== APPLY_CONFIRMATION) {
    throw new Error(`confirmation must be exactly ${APPLY_CONFIRMATION}`);
  }
  if (
    options.environment === 'local' &&
    !new Set(['127.0.0.1', 'localhost', '::1']).has(parsed.hostname)
  ) {
    throw new Error('local apply requires a loopback database host');
  }
  return targetDatabase;
}

function dispositionCounts(
  dispositions: ReadonlyMap<number, { kind: string }>,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const disposition of dispositions.values()) {
    counts[disposition.kind] = (counts[disposition.kind] ?? 0) + 1;
  }
  return counts;
}

export async function runLegacyImportCli(
  args: readonly string[],
  databaseUrl: string,
  onReport?: (report: SafeLegacyImportReport) => void,
): Promise<SafeLegacyImportReport> {
  const options = parseLegacyImportCliOptions(args);
  const targetDatabase = validateLegacyImportTarget(options, databaseUrl);
  const raw = await readFile(options.bundlePath, 'utf8');
  const bundle = validateLegacyBundle(JSON.parse(raw) as unknown);
  const bundleSha256 = hashLegacyPayload(bundle);
  if (
    options.expectedBundleSha256 &&
    bundleSha256 !== options.expectedBundleSha256
  ) {
    throw new Error('bundle SHA-256 does not match --expected-bundle-sha256');
  }
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });
  try {
    const target = await loadTargetSnapshot(prisma);
    const plan = buildLegacyImportPlan(bundle, target, new Date(options.cutoverAt));
    const base: SafeLegacyImportReport = {
      mode: options.mode,
      bundleSha256,
      targetDatabase,
      sourceAppointments: bundle.appointments.length,
      excludedFuture: plan.excludedAppointmentIds.length,
      historicalServices: plan.historicalServices.length,
      newHistoricalEmployees: plan.newHistoricalEmployees.length,
      matchedCurrentEmployees: plan.matchedCurrentEmployeeIds.length,
      newClients: plan.clientMatches.newClients.length,
      matchedCurrentClients: plan.clientMatches.matchedCurrentClientIds.length,
      plannedBookings: plan.newBookings.length,
      dispositions: dispositionCounts(plan.appointmentDispositions),
      insertedBookings: 0,
      technicalExceptions: [15747, 15834],
    };
    if (options.mode === 'dry-run') {
      onReport?.(base);
      return base;
    }
    const expectedFinance = {
      invoices: await prisma.invoice.count(),
      payments: await prisma.payment.count(),
    };
    const expectedComms = {
      notifications: await prisma.notification.count(),
      outboxEvents: await prisma.outboxEvent.count(),
    };
    const apply = await applyLegacyImportPlan(prisma, bundle, plan);
    const audit = await collectLegacyImportAudit(
      prisma,
      plan.excludedAppointmentIds,
    );
    assertLegacyImportAudit(audit, expectedFinance, expectedComms);
    const report = { ...base, insertedBookings: apply.insertedBookings, apply, audit };
    onReport?.(report);
    return report;
  } finally {
    await prisma.$disconnect();
  }
}

export async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  await runLegacyImportCli(process.argv.slice(2), databaseUrl, (report) => {
    process.stdout.write(`${serializeSafeLegacyImportReport(report)}\n`);
  });
}
