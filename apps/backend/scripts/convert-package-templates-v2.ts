import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import {
  auditPackageTemplates,
  buildDraftPreview,
  buildProtectedMapping,
  loadOfferingEvidence,
  readProtectedManifest,
  sourceRevision,
  type AuditDatabase,
  type LegacyPackage,
  type LegacyPackagePrice,
  type OfferingEvidence,
  type PackageConversionManifest,
  type ProtectedConversionMapping,
  writeProtectedJson,
} from './data-integrity/audit-package-group-conversion';
import { ComputePackagePriceService } from '../src/modules/org-experience/compute-package-price.service';
import { resolvePackageGroupOfferings } from '../src/modules/org-experience/session-packages/package-group-offering.helper';
import type { PackageGroupInputLike } from '../src/modules/org-experience/session-packages/package-group-offering.helper';

export interface ConversionManifestInput {
  version: 1;
  database: string;
  schema: string;
  generatedAt: string;
  mappings: ProtectedConversionMapping[];
  aggregate: PackageConversionManifest['aggregate'];
}

export type ConversionDatabase = Omit<AuditDatabase, '$transaction'> & {
  sessionPackage: AuditDatabase['sessionPackage'] & {
    findUnique(args: unknown): Promise<LegacyPackage | null>;
    create(args: unknown): Promise<{ id: string }>;
  };
  sessionPackageGroup: { create(args: unknown): Promise<{ id: string }> };
  sessionPackageItem: { create(args: unknown): Promise<unknown> };
  packageTemplateConversion: {
    findUnique(args: unknown): Promise<{ draftPackageId: string } | null>;
    create(args: unknown): Promise<{ draftPackageId: string }>;
  };
  $queryRawUnsafe: (...args: unknown[]) => Promise<unknown>;
  $transaction: <T>(fn: (tx: ConversionDatabase) => Promise<T>, options?: unknown) => Promise<T>;
};

export interface ApplyOptions {
  selectedSourcePackageIds: readonly string[];
  expectedDatabase?: string;
  database?: string;
  pricePackage?: (pkg: LegacyPackage) => Promise<LegacyPackagePrice>;
  offerings?: Map<string, OfferingEvidence>;
  schema?: string;
}

export interface ConversionReceipt {
  sourcePackageId: string;
  sourceRevision: string;
  draftPackageId: string;
  replayed: boolean;
  classification: 'READY_DRAFT';
}

const SAFE_DATABASE_NAME = /^[a-z0-9][a-z0-9_-]{0,62}$/i;

function fail(message: string): never {
  throw new Error(message);
}

function canonicalPreviewValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalPreviewValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalPreviewValue(entry)]),
    );
  }
  return value;
}

export function protectedPreviewSignature(mapping: ProtectedConversionMapping): string {
  return JSON.stringify(canonicalPreviewValue({ before: mapping.before, after: mapping.after }));
}

function isUniqueConflict(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && (error as { code?: unknown }).code === 'P2002');
}

function isSerializationConflict(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && (error as { code?: unknown }).code === 'P2034');
}

export function isProductionDatabaseName(name: string): boolean {
  return /(^|[-_])(prod|production|live)([-_]|$)/i.test(name) || /^(prod|production|live)$/i.test(name);
}

export function validateExpectedDatabase(actual: string, expected: string): void {
  if (!SAFE_DATABASE_NAME.test(expected)) fail('Expected database name is invalid');
  if (isProductionDatabaseName(expected)) fail('Refusing to run against a production database marker');
  if (actual !== expected) fail('Connected database does not match --expected-database');
}

export function validateDatabaseUrlTarget(databaseUrl: string, expectedDatabase: string): void {
  if (!databaseUrl.trim()) fail('DATABASE_URL is required');
  let parsedUrl: URL;
  try { parsedUrl = new URL(databaseUrl); } catch { fail('DATABASE_URL must be a valid postgres URL'); }
  const databaseName = decodeURIComponent(parsedUrl.pathname.replace(/^\/+/, ''));
  validateExpectedDatabase(databaseName, expectedDatabase);
}

export function validateConversionManifest(
  manifest: unknown,
  selectedSourcePackageIds: readonly string[],
): ConversionManifestInput {
  if (!manifest || typeof manifest !== 'object') fail('Invalid conversion manifest');
  const candidate = manifest as Partial<ConversionManifestInput>;
  if (candidate.version !== 1 || !Array.isArray(candidate.mappings) || typeof candidate.database !== 'string' || typeof candidate.schema !== 'string') fail('Invalid conversion manifest');
  const selected = new Set(selectedSourcePackageIds);
  if (selected.size !== selectedSourcePackageIds.length || selected.size === 0) fail('Apply requires explicit selected source package IDs');
  const mappings = candidate.mappings as ProtectedConversionMapping[];
  const seen = new Set<string>();
  for (const mapping of mappings) {
    if (!mapping || typeof mapping.sourcePackageId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(mapping.sourcePackageId)) fail('Invalid source package ID in manifest');
    if (!/^[a-f0-9]{64}$/.test(mapping.sourceRevision)) fail('Invalid source revision in manifest');
    if (seen.has(mapping.sourcePackageId)) fail('Duplicate source package mapping');
    seen.add(mapping.sourcePackageId);
    if (mapping.classification !== 'READY_DRAFT' && selected.has(mapping.sourcePackageId)) fail('Selected source package is not READY_DRAFT');
  }
  for (const id of selected) if (!seen.has(id)) fail(`Selected source package is absent from manifest: ${id}`);
  return candidate as ConversionManifestInput;
}

function draftCreateData(pkg: LegacyPackage): Record<string, unknown> {
  return {
    modelVersion: 'GROUPED_V2',
    ownerEmployeeId: null,
    nameAr: pkg.nameAr,
    nameEn: pkg.nameEn ?? null,
    descriptionAr: pkg.descriptionAr ?? null,
    descriptionEn: pkg.descriptionEn ?? null,
    imageUrl: pkg.imageUrl ?? null,
    iconName: pkg.iconName ?? null,
    iconBgColor: pkg.iconBgColor ?? null,
    discountType: 'PERCENTAGE',
    discountValue: 0,
    isActive: false,
    isPublic: false,
    sortOrder: pkg.sortOrder ?? 0,
  };
}

function draftGroupData(
  preview: ReturnType<typeof buildDraftPreview>,
  packageId: string,
): Array<{ id: string; key: string; packageId: string; serviceId: string; employeeId: string; sequenceMode: 'UNORDERED'; sortOrder: number; sessions: ReturnType<typeof buildDraftPreview>['groups'][number]['sessions'] }> {
  return preview.groups.map((group, groupIndex) => ({
    id: randomUUID(), key: group.key, packageId, serviceId: group.serviceId, employeeId: group.employeeId,
    sequenceMode: 'UNORDERED', sortOrder: groupIndex, sessions: group.sessions,
  }));
}

function draftItemData(packageId: string, group: DraftGroupData, session: DraftGroupData['sessions'][number]): Record<string, unknown> {
  return {
    id: randomUUID(), packageId, groupId: group.id, sessionPosition: session.position,
    serviceId: group.serviceId, employeeId: group.employeeId, durationOptionId: session.durationOptionId,
    unitPrice: session.unitPrice, paidQuantity: 1, freeQuantity: 0,
    discountType: null, discountValue: 0, sortOrder: session.position,
    constraints: { create: [
      { dimension: 'SERVICE', mode: 'INCLUDE', targets: { create: [{ targetId: group.serviceId }] } },
      { dimension: 'PRACTITIONER', mode: 'INCLUDE', targets: { create: [{ targetId: group.employeeId }] } },
      { dimension: 'DURATION', mode: 'INCLUDE', targets: { create: [{ targetId: session.durationOptionId }] } },
      { dimension: 'DELIVERY_TYPE', mode: 'INCLUDE', targets: { create: [{ targetId: session.deliveryType }] } },
    ] },
  };
}

type DraftGroupData = ReturnType<typeof draftGroupData>[number];

async function applyOne(
  db: ConversionDatabase,
  manifestMapping: ProtectedConversionMapping,
  options: ApplyOptions,
): Promise<ConversionReceipt> {
  const run = async (tx: ConversionDatabase): Promise<ConversionReceipt> => {
    // Lock the mutable source before revision and offering checks. This keeps
    // a catalog edit from racing the provenance insert in another apply.
    await tx.$queryRawUnsafe(
      'SELECT "id" FROM "SessionPackage" WHERE "id" = $1 FOR UPDATE',
      manifestMapping.sourcePackageId,
    );
    const source = await tx.sessionPackage.findUnique({
      where: { id: manifestMapping.sourcePackageId },
      include: { items: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }], include: { constraints: { orderBy: { dimension: 'asc' }, include: { targets: { orderBy: { targetId: 'asc' } } } } } } },
    });
    if (!source || source.modelVersion !== 'LEGACY') fail('Source package is missing or is no longer LEGACY');
    const currentRevision = sourceRevision(source);
    if (currentRevision !== manifestMapping.sourceRevision) fail(`Stale source revision for ${source.id}`);

    const prices = options.pricePackage
      ? await options.pricePackage(source)
      : await new ComputePackagePriceService(tx as never).compute({
        items: source.items.map((item) => ({
          serviceId: item.serviceId,
          employeeId: item.employeeId,
          durationOptionId: item.durationOptionId,
          unitPrice: item.unitPrice == null ? null : Number(item.unitPrice),
          paidQuantity: item.paidQuantity,
          freeQuantity: item.freeQuantity ?? 0,
          discountType: item.discountType as never,
          discountValue: Number(item.discountValue ?? 0),
        })),
      });
      const offerings = options.offerings ?? await loadOfferingEvidence(tx, [source]);
    const purchases = await tx.packagePurchase.findMany({
      where: { packageId: source.id },
      select: { id: true, packageId: true },
    });
    const credits = purchases.length === 0
      ? []
      : await tx.packageCredit.findMany({
        where: { purchaseId: { in: purchases.map((purchase) => purchase.id) } },
        select: { id: true, purchaseId: true },
      });
    const freshMapping = buildProtectedMapping(source, prices, offerings, purchases.length, credits.length);
    if (freshMapping.classification !== 'READY_DRAFT' || !freshMapping.after) fail(`Source package is not READY_DRAFT: ${freshMapping.reasons.join(',') || 'offering review required'}`);
    if (protectedPreviewSignature(freshMapping) !== protectedPreviewSignature(manifestMapping)) {
      fail('Approved conversion preview changed; run a new audit before applying');
    }
    const validatedGroups = await resolvePackageGroupOfferings(
      tx as never,
      freshMapping.after.groups.map((group) => ({
        key: group.key,
        serviceId: group.serviceId,
        employeeId: group.employeeId,
        sequenceMode: group.sequenceMode,
        dependsOnGroupKey: null,
        sessions: group.sessions.map((session) => ({
          key: `${group.key}-${session.position}`,
          position: session.position,
          durationOptionId: session.durationOptionId,
          deliveryType: session.deliveryType,
          unitPrice: session.unitPrice,
        })),
      })) as PackageGroupInputLike[],
    );
    if (validatedGroups.flatMap((group) => group.sessions).length !== freshMapping.after.totalRights) fail('Catalog validator returned an incomplete converted draft');
    const conversions = tx.packageTemplateConversion;
    const existing = await conversions.findUnique({
      where: { sourcePackageId_sourceRevision: { sourcePackageId: manifestMapping.sourcePackageId, sourceRevision: manifestMapping.sourceRevision } },
      select: { draftPackageId: true },
    });
    if (existing) {
      return {
        sourcePackageId: manifestMapping.sourcePackageId,
        sourceRevision: manifestMapping.sourceRevision,
        draftPackageId: existing.draftPackageId,
        replayed: true,
        classification: 'READY_DRAFT',
      };
    }
    const draft = await tx.sessionPackage.create({ data: draftCreateData(source) });
    const groups = draftGroupData(freshMapping.after, draft.id);
    for (const group of groups) {
      await tx.sessionPackageGroup.create({ data: {
        id: group.id, packageId: group.packageId, key: group.key,
        serviceId: group.serviceId, employeeId: group.employeeId,
        sequenceMode: group.sequenceMode, dependsOnGroupId: null, sortOrder: group.sortOrder,
      } });
      for (const session of group.sessions) {
        await tx.sessionPackageItem.create({ data: draftItemData(draft.id, group, session) });
      }
    }
    await conversions.create({ data: { sourcePackageId: source.id, sourceRevision: currentRevision, draftPackageId: draft.id } });
    return { sourcePackageId: source.id, sourceRevision: currentRevision, draftPackageId: draft.id, replayed: false, classification: 'READY_DRAFT' };
  };
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await db.$transaction(run, { isolationLevel: 'Serializable' });
    } catch (error) {
      if (isSerializationConflict(error) && attempt === 0) continue;
      if (!isUniqueConflict(error)) throw error;
      const replay = await db.packageTemplateConversion.findUnique({
        where: { sourcePackageId_sourceRevision: { sourcePackageId: manifestMapping.sourcePackageId, sourceRevision: manifestMapping.sourceRevision } },
        select: { draftPackageId: true },
      });
      if (!replay) throw error;
      return { sourcePackageId: manifestMapping.sourcePackageId, sourceRevision: manifestMapping.sourceRevision, draftPackageId: replay.draftPackageId, replayed: true, classification: 'READY_DRAFT' };
    }
  }
  throw new Error('Conversion transaction did not complete');
}

export async function applyPackageTemplateConversions(
  db: ConversionDatabase,
  manifest: unknown,
  options: ApplyOptions,
): Promise<ConversionReceipt[]> {
  const validated = validateConversionManifest(manifest, options.selectedSourcePackageIds);
  if (!options.database || !options.expectedDatabase) fail('Apply requires database and expectedDatabase guards');
  validateExpectedDatabase(options.database, options.expectedDatabase);
  if (validated.database !== options.expectedDatabase) fail('Manifest database does not match expectedDatabase');
  if (validated.schema !== (options.schema ?? 'public')) fail('Manifest schema does not match expected schema');
  const selected = new Set(options.selectedSourcePackageIds);
  const mappings = validated.mappings.filter((mapping) => selected.has(mapping.sourcePackageId));
  const receipts: ConversionReceipt[] = [];
  for (const mapping of mappings) receipts.push(await applyOne(db, mapping, options));
  return receipts;
}

interface CliOptions {
  mode: 'dry-run' | 'apply';
  output: string;
  manifest?: string;
  expectedDatabase: string;
  selected: string[];
}

export function parseConversionCliArgs(args: readonly string[]): CliOptions {
  let mode: 'dry-run' | 'apply' = 'dry-run';
  let output: string | undefined;
  let manifest: string | undefined;
  let expectedDatabase: string | undefined;
  const selected: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--apply' || arg === 'apply') { if (mode === 'apply') fail('Mode may be specified only once'); mode = 'apply'; continue; }
    if (arg === '--dry-run' || arg === 'dry-run') { if (mode === 'apply') fail('Mode may be specified only once'); mode = 'dry-run'; continue; }
    const value = args[index + 1];
    if (arg === '--output') { if (!value || value.startsWith('--')) fail('--output requires a value'); output = value; index += 1; continue; }
    if (arg === '--manifest') { if (!value || value.startsWith('--')) fail('--manifest requires a value'); manifest = value; index += 1; continue; }
    if (arg === '--expected-database') { if (!value || value.startsWith('--')) fail('--expected-database requires a value'); expectedDatabase = value; index += 1; continue; }
    if (arg === '--select') { if (!value || value.startsWith('--')) fail('--select requires a value'); selected.push(value); index += 1; continue; }
    if (arg.startsWith('-')) fail(`Unknown argument: ${arg}`);
    fail(`Unexpected positional argument: ${arg}`);
  }
  if (!output) fail('Conversion requires --output');
  if (!expectedDatabase) fail('Conversion requires --expected-database');
  if (isProductionDatabaseName(expectedDatabase)) fail('Refusing to run against a production database marker');
  if (mode === 'apply' && !manifest) fail('Apply requires --manifest');
  if (mode === 'apply' && selected.length === 0) fail('Apply requires at least one --select source package ID');
  if (mode === 'dry-run' && (manifest || selected.length > 0)) fail('Manifest and selection are apply-only arguments');
  return { mode, output, manifest, expectedDatabase, selected };
}

export async function runConversionCli(args: readonly string[], environment: { DATABASE_URL?: string } = process.env): Promise<unknown> {
  const options = parseConversionCliArgs(args);
  if (isProductionDatabaseName(options.expectedDatabase)) fail('Refusing to run against a production database marker');
  const databaseUrl = environment.DATABASE_URL?.trim();
  if (!databaseUrl) fail('DATABASE_URL is required');
  validateDatabaseUrlTarget(databaseUrl, options.expectedDatabase);
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  try {
    await prisma.$connect();
    const identity = await prisma.$queryRaw<Array<{ database: string }>>`SELECT current_database() AS database`;
    validateExpectedDatabase(identity[0]?.database ?? '', options.expectedDatabase);
    if (options.mode === 'dry-run') {
      const manifest = await auditPackageTemplates(prisma as never, { database: options.expectedDatabase });
      await writeProtectedJson(options.output, manifest);
      return manifest;
    }
    const manifest = await readProtectedManifest(options.manifest!);
    if (manifest.database !== options.expectedDatabase) fail('Manifest database does not match --expected-database');
    const receipts = await applyPackageTemplateConversions(prisma as never, manifest, { selectedSourcePackageIds: options.selected, expectedDatabase: options.expectedDatabase, database: options.expectedDatabase });
    await writeProtectedJson(options.output, { version: 1, database: options.expectedDatabase, appliedAt: new Date().toISOString(), receipts });
    return receipts;
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}

if (require.main === module) {
  runConversionCli(process.argv.slice(2)).then(() => console.log('conversion complete')).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'conversion failed');
    process.exitCode = 1;
  });
}
