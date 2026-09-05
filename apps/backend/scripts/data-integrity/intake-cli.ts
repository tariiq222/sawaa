import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { open, readFile, type FileHandle } from 'node:fs/promises';
import { basename } from 'node:path';
import {
  applyIntakeManifest,
  type IntakeApplyReceipt,
} from './intake-apply';
import {
  createIntakeManifest,
  type IntakeManifest,
} from './intake-manifest';

export type IntakeCliMode = 'dry-run' | 'apply';

export interface IntakeCliOptions {
  mode: IntakeCliMode;
  outputPath?: string;
  maxGroups?: number;
  manifestPath?: string;
  receiptPath?: string;
  confirmDatabase?: string;
  oldWritersDrained: boolean;
}

const USAGE = `Usage:
  intake-cli [dry-run|--dry-run] --output <manifest.json> [--max-groups <1..100>]
  intake-cli apply|--apply --manifest <reviewed-manifest.json> --receipt <receipt.ndjson>
    --confirm-database <database-name> --old-writers-drained`;

export class IntakeCliHelpRequested extends Error {
  constructor() {
    super(USAGE);
    this.name = 'IntakeCliHelpRequested';
  }
}

const SAFE_CORE_ERRORS = [
  /^Invalid manifest$/,
  /^Invalid manifest identity or batch$/,
  /^Invalid group$/,
  /^Duplicate manifest group$/,
  /^Manifest contains unresolved group$/,
  /^Missing reviewer$/,
  /^Invalid source fingerprint$/,
  /^Unknown canonical source$/,
  /^Old intake writers must be drained before apply$/,
  /^Database confirmation does not match manifest$/,
  /^Connected database does not match reviewed manifest$/,
  /^maxGroups must be an integer from 1 to 100$/,
];

function fail(message: string): never {
  throw new Error(message);
}

function requireValue(args: readonly string[], index: number, flag: string): string {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) fail(`${flag} requires a value`);
  return value;
}

/** Parse CLI arguments without reading env or opening a database. */
export function parseIntakeCliArgs(args: readonly string[]): IntakeCliOptions {
  let mode: IntakeCliMode = 'dry-run';
  let modeSeen = false;
  let outputPath: string | undefined;
  let maxGroups: number | undefined;
  let manifestPath: string | undefined;
  let receiptPath: string | undefined;
  let confirmDatabase: string | undefined;
  let oldWritersDrained = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--help' || arg === '-h') throw new IntakeCliHelpRequested();
    if (arg === 'dry-run' || arg === 'apply' || arg === '--dry-run' || arg === '--apply') {
      if (modeSeen) fail('Mode may be specified only once');
      mode = arg.replace(/^--/, '') as IntakeCliMode;
      modeSeen = true;
      continue;
    }
    if (arg === '--output') {
      if (outputPath) fail('--output may be specified only once');
      outputPath = requireValue(args, index, '--output');
      index += 1;
      continue;
    }
    if (arg === '--max-groups') {
      if (maxGroups !== undefined) fail('--max-groups may be specified only once');
      const value = requireValue(args, index, '--max-groups');
      if (!/^\d+$/.test(value)) fail('--max-groups must be an integer from 1 to 100');
      maxGroups = Number(value);
      if (!Number.isInteger(maxGroups) || maxGroups < 1 || maxGroups > 100) {
        fail('--max-groups must be an integer from 1 to 100');
      }
      index += 1;
      continue;
    }
    if (arg === '--manifest') {
      if (manifestPath) fail('--manifest may be specified only once');
      manifestPath = requireValue(args, index, '--manifest');
      index += 1;
      continue;
    }
    if (arg === '--receipt') {
      if (receiptPath) fail('--receipt may be specified only once');
      receiptPath = requireValue(args, index, '--receipt');
      index += 1;
      continue;
    }
    if (arg === '--confirm-database') {
      if (confirmDatabase) fail('--confirm-database may be specified only once');
      confirmDatabase = requireValue(args, index, '--confirm-database');
      index += 1;
      continue;
    }
    if (arg === '--old-writers-drained') {
      if (oldWritersDrained) fail('--old-writers-drained may be specified only once');
      oldWritersDrained = true;
      continue;
    }
    if (arg.startsWith('-')) fail(`Unknown argument: ${arg}`);
    fail(`Unexpected positional argument: ${arg}`);
  }

  if (mode === 'dry-run') {
    if (!outputPath) fail('Dry-run requires --output');
    if (manifestPath || receiptPath || confirmDatabase || oldWritersDrained) {
      fail('Apply-only arguments require apply mode');
    }
  } else {
    if (outputPath || maxGroups !== undefined) fail('Dry-run arguments require dry-run mode');
    if (!manifestPath) fail('Apply requires --manifest');
    if (!receiptPath) fail('Apply requires --receipt');
    if (!confirmDatabase) fail('Apply requires --confirm-database');
    if (!oldWritersDrained) fail('Apply requires --old-writers-drained');
  }

  return {
    mode,
    outputPath,
    maxGroups,
    manifestPath,
    receiptPath,
    confirmDatabase,
    oldWritersDrained,
  };
}

function databaseNameFromUrl(databaseUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    fail('DATABASE_URL must be a valid postgres URL');
  }
  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
    fail('DATABASE_URL must use the postgres or postgresql protocol');
  }
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
  if (!databaseName) fail('DATABASE_URL must include a database name');
  return databaseName;
}

function parseJson(value: string, sourceName: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    fail(`Could not parse JSON from ${basename(sourceName)}`);
  }
}

async function readJsonFile(path: string): Promise<unknown> {
  try {
    return parseJson(await readFile(path, 'utf8'), path);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Could not parse JSON')) throw error;
    fail(`Could not read ${basename(path)}`);
  }
}

/** Create a protected output file and refuse to overwrite an existing file. */
export async function writeExclusiveJson(path: string, value: unknown): Promise<void> {
  let handle: FileHandle | undefined;
  try {
    handle = await open(path, 'wx', 0o600);
    await handle.chmod(0o600);
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
  } catch (error) {
    if (error !== null && typeof error === 'object'
      && 'code' in error && String((error as { code?: unknown }).code) === 'EEXIST') {
      fail(`Refusing to overwrite existing output ${basename(path)}`);
    }
    fail(`Could not create output ${basename(path)}`);
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

export interface ExclusiveNdjsonWriter {
  append(value: unknown): Promise<void>;
  close(): Promise<void>;
}

/** Open a protected append-only receipt stream and fsync every complete line. */
export async function openExclusiveNdjson(path: string): Promise<ExclusiveNdjsonWriter> {
  let handle: FileHandle;
  try {
    handle = await open(path, 'wx', 0o600);
    await handle.chmod(0o600);
  } catch (error) {
    if (error !== null && typeof error === 'object'
      && 'code' in error && String((error as { code?: unknown }).code) === 'EEXIST') {
      fail(`Refusing to overwrite existing output ${basename(path)}`);
    }
    fail(`Could not create output ${basename(path)}`);
  }

  let closed = false;
  return {
    async append(value: unknown): Promise<void> {
      if (closed) fail('Receipt output is already closed');
      await handle.writeFile(`${JSON.stringify(value)}\n`, 'utf8');
      await handle.sync();
    },
    async close(): Promise<void> {
      if (closed) return;
      closed = true;
      await handle.close();
    },
  };
}

function safeErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return 'operation failed';
  if (SAFE_CORE_ERRORS.some((pattern) => pattern.test(error.message))) return error.message;
  if (error.message.startsWith('Dry-run requires') || error.message.startsWith('Apply requires')
    || error.message.startsWith('Apply-only arguments') || error.message.startsWith('Dry-run arguments')
    || error.message.startsWith('Unknown argument') || error.message.startsWith('Unexpected positional')
    || error.message.startsWith('Mode may be') || error.message.startsWith('--')
    || error.message.startsWith('Could not ') || error.message.startsWith('DATABASE_URL')) {
    return error.message;
  }
  return 'database operation failed; no database details were printed';
}

export interface IntakeCliEnvironment {
  DATABASE_URL?: string;
}

export async function runIntakeCli(
  args: readonly string[],
  environment: IntakeCliEnvironment = process.env,
): Promise<{ mode: IntakeCliMode; count: number; statuses?: Record<string, number> }> {
  const options = parseIntakeCliArgs(args);
  const databaseUrl = environment.DATABASE_URL?.trim();
  if (!databaseUrl) fail('DATABASE_URL is required');
  databaseNameFromUrl(databaseUrl);
  const reviewed = options.mode === 'apply'
    ? await readJsonFile(options.manifestPath!)
    : undefined;
  const receiptWriter = options.mode === 'apply'
    ? await openExclusiveNdjson(options.receiptPath!)
    : undefined;
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });

  try {
    await prisma.$connect();
    if (options.mode === 'dry-run') {
      const manifest = await createIntakeManifest(prisma, options.maxGroups ?? 100);
      await writeExclusiveJson(options.outputPath!, manifest);
      return { mode: options.mode, count: manifest.groups.length };
    }

    const receipts = await applyIntakeManifest(prisma, reviewed, {
      expectedDatabase: options.confirmDatabase!,
      oldWritersDrained: options.oldWritersDrained,
      onReceipt: (receipt) => receiptWriter!.append(receipt),
    });
    return {
      mode: options.mode,
      count: receipts.length,
      statuses: receipts.reduce<Record<string, number>>((counts, receipt) => {
        counts[receipt.status] = (counts[receipt.status] ?? 0) + 1;
        return counts;
      }, {}),
    };
  } finally {
    await prisma.$disconnect().catch(() => undefined);
    await receiptWriter?.close().catch(() => undefined);
  }
}

async function main(): Promise<void> {
  try {
    const result = await runIntakeCli(process.argv.slice(2));
    if (result.mode === 'dry-run') {
      console.log(`dry-run complete; manifest groups: ${result.count}`);
    } else {
      const statuses = Object.entries(result.statuses ?? {})
        .map(([status, count]) => `${status}=${count}`).join(' ');
      console.log(`apply complete; groups: ${result.count}${statuses ? `; ${statuses}` : ''}`);
    }
  } catch (error) {
    if (error instanceof IntakeCliHelpRequested) {
      console.log(error.message);
      return;
    }
    console.error(`intake tool failed: ${safeErrorMessage(error)}`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  void main();
}

export type { IntakeApplyReceipt, IntakeManifest };
