import { type PrismaClient } from '@prisma/client';
import { intakeFingerprint, type IntakeManifest, type IntakeManifestGroup } from './intake-manifest';

/** Parse untrusted edited JSON before opening any write transaction. */
export function assertReviewedManifest(value: unknown): asserts value is IntakeManifest {
  if (!value || typeof value !== 'object') throw new Error('Invalid manifest');
  const manifest = value as Partial<IntakeManifest>;
  if (manifest.version !== 1 || typeof manifest.database !== 'string' || !manifest.database
    || typeof manifest.schema !== 'string' || !manifest.schema || !Array.isArray(manifest.groups)
    || manifest.groups.length > 100) throw new Error('Invalid manifest identity or batch');
  const pairs = new Set<string>();
  for (const group of manifest.groups) {
    if (!group || typeof group.bookingId !== 'string' || typeof group.formId !== 'string'
      || !Array.isArray(group.sources) || group.sources.length < 2) throw new Error('Invalid group');
    const pair = JSON.stringify([group.bookingId, group.formId]);
    if (pairs.has(pair)) throw new Error('Duplicate manifest group');
    pairs.add(pair);
    if (!group.canonicalId) throw new Error('Manifest contains unresolved group');
    if (typeof group.reviewedBy !== 'string' || !group.reviewedBy.trim()) throw new Error('Missing reviewer');
    const ids = new Set<string>();
    for (const source of group.sources) {
      if (!source || typeof source.id !== 'string' || ids.has(source.id)
        || !/^[a-f0-9]{64}$/.test(source.fingerprint) || !/^[a-f0-9]{64}$/.test(source.answersHash)) {
        throw new Error('Invalid source fingerprint');
      }
      ids.add(source.id);
    }
    if (!ids.has(group.canonicalId)) throw new Error('Unknown canonical source');
  }
}

export interface IntakeApplyReceipt {
  bookingId: string;
  formId: string;
  canonicalId: string;
  reviewedBy: string;
  status: 'applied' | 'alreadyApplied' | 'conflict';
}

export interface IntakeApplyOptions {
  expectedDatabase: string;
  oldWritersDrained: boolean;
  /** Called and awaited after each group transaction commits. */
  onReceipt?: (receipt: IntakeApplyReceipt) => Promise<void> | void;
}

/** No defaults authorize apply. Actual customer use requires separate approval. */
export async function applyIntakeManifest(
  prisma: PrismaClient,
  input: unknown,
  options: IntakeApplyOptions,
): Promise<IntakeApplyReceipt[]> {
  assertReviewedManifest(input);
  if (!options.oldWritersDrained) throw new Error('Old intake writers must be drained before apply');
  if (options.expectedDatabase !== input.database) throw new Error('Database confirmation does not match manifest');
  const [connectedIdentity] = await prisma.$queryRaw<Array<{ database: string; schema: string }>>`
    SELECT current_database() AS database, current_schema() AS schema
  `;
  if (connectedIdentity.database !== input.database || connectedIdentity.schema !== input.schema) {
    throw new Error('Connected database does not match reviewed manifest');
  }
  const receipts: IntakeApplyReceipt[] = [];
  for (const group of input.groups) {
    const status = await prisma.$transaction(async (tx) => {
      const [identity] = await tx.$queryRaw<Array<{ database: string; schema: string }>>`
        SELECT current_database() AS database, current_schema() AS schema
      `;
      if (identity.database !== input.database || identity.schema !== input.schema) {
        throw new Error('Connected database does not match reviewed manifest');
      }
      // Same parent -> pair order as the compatible writer. Parent deletion
      // cannot overlap; the advisory lock serializes submit and canonicalize.
      const [booking] = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "Booking" WHERE "id" = ${group.bookingId} FOR SHARE
      `;
      const [form] = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "IntakeForm" WHERE "id" = ${group.formId} FOR SHARE
      `;
      if (!booking || !form) return 'conflict' as const;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`intake:${group.bookingId}:${group.formId}`}, 0))`;
      const rows = await tx.intakeResponse.findMany({
        where: { bookingId: group.bookingId, formId: group.formId },
      });
      const sources = new Map(group.sources.map((source) => [source.id, source]));
      const reviewedRows = rows.filter((row) => sources.has(row.id));
      if (reviewedRows.length !== sources.size || reviewedRows.some((row) =>
        intakeFingerprint(row) !== sources.get(row.id)!.fingerprint)) return 'conflict' as const;
      const current = rows.filter((row) => row.supersededAt === null);
      if (current.length === 1 && current[0].id === group.canonicalId
        && reviewedRows.every((row) => row.id === group.canonicalId
          || (row.supersededAt !== null && row.supersededById === group.canonicalId))) {
        return 'alreadyApplied' as const;
      }
      if (current.length !== sources.size || current.some((row) => !sources.has(row.id))) {
        return 'conflict' as const;
      }
      await tx.intakeResponse.updateMany({
        where: { id: { in: group.sources.filter((source) => source.id !== group.canonicalId).map((source) => source.id) },
          supersededAt: null },
        data: { supersededAt: new Date(), supersededById: group.canonicalId },
      });
      return 'applied' as const;
    }, { timeout: 30_000 });
    const result = receipt(group, status);
    receipts.push(result);
    await options.onReceipt?.(result);
  }
  return receipts;
}

function receipt(group: IntakeManifestGroup, status: IntakeApplyReceipt['status']): IntakeApplyReceipt {
  return { bookingId: group.bookingId, formId: group.formId, canonicalId: group.canonicalId!,
    reviewedBy: group.reviewedBy!, status };
}
