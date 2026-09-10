import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import {
  AUDIT_CATEGORIES,
  auditFinanceBookings,
  type AuditCategory,
  type AuditCursor,
  type FinanceBookingsAuditPage,
} from './audit-finance-bookings';
import { writeExclusiveJson } from './intake-cli';

export interface AuditCliOptions {
  outputPath: string;
  batchSize: number;
  stalledOutboxHours: number;
  cursors: AuditCursor;
  completedCategories: AuditCategory[];
}

const USAGE = `Usage:
  audit-finance-cli --output <audit.json> [--batch-size <1..100>]
    [--stalled-hours <0..8760>] [--cursor <CATEGORY=VALUE>]
    [--completed <CATEGORY>]

This command is read-only and does not support apply or repair flags.`;

export class AuditCliHelpRequested extends Error {
  constructor() {
    super(USAGE);
    this.name = 'AuditCliHelpRequested';
  }
}

function fail(message: string): never {
  throw new Error(message);
}

function requireValue(args: readonly string[], index: number, flag: string): string {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) fail(`${flag} requires a value`);
  return value;
}

function category(value: string, flag: string): AuditCategory {
  if (!AUDIT_CATEGORIES.includes(value as AuditCategory)) fail(`${flag} must name a known audit category`);
  return value as AuditCategory;
}

export function parseAuditCliArgs(args: readonly string[]): AuditCliOptions {
  let outputPath: string | undefined;
  let batchSize = 100;
  let stalledOutboxHours = 24;
  const cursors: AuditCursor = {};
  const completedCategories: AuditCategory[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--help' || arg === '-h') throw new AuditCliHelpRequested();
    if (arg === '--apply' || arg === 'apply' || arg.startsWith('--repair')) {
      fail('Apply and repair modes are not supported by the read-only audit tool');
    }
    if (arg === '--output') {
      if (outputPath) fail('--output may be specified only once');
      outputPath = requireValue(args, index, '--output');
      index += 1;
      continue;
    }
    if (arg === '--batch-size') {
      const value = requireValue(args, index, '--batch-size');
      if (!/^\d+$/.test(value)) fail('--batch-size must be an integer from 1 to 100');
      batchSize = Number(value);
      if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 100) {
        fail('--batch-size must be an integer from 1 to 100');
      }
      index += 1;
      continue;
    }
    if (arg === '--stalled-hours') {
      const value = requireValue(args, index, '--stalled-hours');
      stalledOutboxHours = Number(value);
      if (!Number.isFinite(stalledOutboxHours) || stalledOutboxHours <= 0 || stalledOutboxHours > 8760) {
        fail('--stalled-hours must be a finite number greater than 0 and at most 8760');
      }
      index += 1;
      continue;
    }
    if (arg === '--cursor') {
      const value = requireValue(args, index, '--cursor');
      const separator = value.indexOf('=');
      if (separator <= 0 || separator === value.length - 1) fail('--cursor must use CATEGORY=VALUE');
      const name = category(value.slice(0, separator), '--cursor');
      if (cursors[name]) fail(`--cursor for ${name} may be specified only once`);
      cursors[name] = value.slice(separator + 1);
      index += 1;
      continue;
    }
    if (arg === '--completed') {
      const name = category(requireValue(args, index, '--completed'), '--completed');
      if (completedCategories.includes(name)) fail(`--completed for ${name} may be specified only once`);
      completedCategories.push(name);
      index += 1;
      continue;
    }
    if (arg.startsWith('-')) fail(`Unknown argument: ${arg}`);
    fail(`Unexpected positional argument: ${arg}`);
  }
  if (!outputPath) fail('Read-only audit requires --output');
  return { outputPath, batchSize, stalledOutboxHours, cursors, completedCategories };
}

function databaseNameFromUrl(databaseUrl: string): string {
  let parsed: URL;
  try { parsed = new URL(databaseUrl); } catch { fail('DATABASE_URL must be a valid postgres URL'); }
  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
    fail('DATABASE_URL must use the postgres or postgresql protocol');
  }
  const name = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
  if (!name) fail('DATABASE_URL must include a database name');
  return name;
}

export async function runAuditCli(
  args: readonly string[],
  environment: { DATABASE_URL?: string } = process.env,
): Promise<FinanceBookingsAuditPage> {
  const options = parseAuditCliArgs(args);
  const databaseUrl = environment.DATABASE_URL?.trim();
  if (!databaseUrl) fail('DATABASE_URL is required');
  databaseNameFromUrl(databaseUrl);
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  try {
    await prisma.$connect();
    const page = await auditFinanceBookings(prisma, {
      batchSize: options.batchSize,
      stalledOutboxHours: options.stalledOutboxHours,
      cursors: options.cursors,
      completedCategories: options.completedCategories,
    });
    await writeExclusiveJson(options.outputPath, page);
    return page;
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}

function safeErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return 'audit operation failed';
  if (/^(DATABASE_URL|Unknown argument|Unexpected positional|--|Read-only audit|Apply and repair|stalledOutboxHours|batchSize)/.test(error.message)) return error.message;
  if (error.message.startsWith('Could not ') || error.message.startsWith('Refusing to overwrite')) return error.message;
  return 'database operation failed; no database details were printed';
}

async function main(): Promise<void> {
  try {
    const page = await runAuditCli(process.argv.slice(2));
    const counts = Object.entries(page.counts).map(([key, value]) => `${key}=${value}`).join(' ');
    console.log(`read-only audit ${page.complete ? 'complete' : 'page incomplete'}; findings=${page.totalFindings}; ${counts}`);
  } catch (error) {
    if (error instanceof AuditCliHelpRequested) {
      console.log(error.message);
      return;
    }
    console.error(`audit tool failed: ${safeErrorMessage(error)}`);
    process.exitCode = 1;
  }
}

if (require.main === module) void main();
