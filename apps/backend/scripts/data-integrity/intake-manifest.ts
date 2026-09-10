import { createHash } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import { canonicalizeIntakeJson } from '../../src/common/database/intake-response-history.helper';

export interface IntakeSource {
  id: string;
  bookingId: string;
  formId: string;
  clientId: string | null;
  answers: unknown;
  createdAt: Date;
  supersededAt: Date | null;
  supersededById: string | null;
}

export interface IntakeManifestGroup {
  bookingId: string;
  formId: string;
  sources: Array<{ id: string; fingerprint: string; answersHash: string }>;
  candidateId: string | null;
  requiresReview: boolean;
  canonicalId: string | null;
  reviewedBy: string | null;
}

export interface IntakeManifest {
  version: 1;
  database: string;
  schema: string;
  generatedAt: string;
  /** True means this is an explicitly bounded batch, never a full integrity pass. */
  moreGroups?: boolean;
  groups: IntakeManifestGroup[];
}

function hash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(canonicalizeIntakeJson(value))).digest('hex');
}

/** Metadata changes are conflicts too; supersession itself is checked separately. */
export function intakeFingerprint(row: IntakeSource): string {
  return hash({ id: row.id, bookingId: row.bookingId, formId: row.formId,
    clientId: row.clientId, createdAt: row.createdAt.toISOString(), answers: row.answers });
}

export function buildManifestGroups(rows: IntakeSource[]): IntakeManifestGroup[] {
  const pairs = new Map<string, IntakeSource[]>();
  for (const row of rows) {
    if (row.supersededAt !== null) continue;
    const key = JSON.stringify([row.bookingId, row.formId]);
    const group = pairs.get(key) ?? [];
    group.push(row);
    pairs.set(key, group);
  }
  return [...pairs.values()].filter((group) => group.length > 1).map((group) => {
    group.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()
      || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const sources = group.map((row) => ({
      id: row.id, fingerprint: intakeFingerprint(row), answersHash: hash(row.answers),
    }));
    const identical = sources.every((source) => source.answersHash === sources[0].answersHash);
    return { bookingId: group[0].bookingId, formId: group[0].formId, sources,
      candidateId: identical ? sources[0].id : null, requiresReview: !identical,
      canonicalId: null, reviewedBy: null };
  });
}

/** READ ONLY is enforced by PostgreSQL, not only by the caller's convention. */
export async function createIntakeManifest(prisma: PrismaClient, maxGroups = 100): Promise<IntakeManifest> {
  if (!Number.isInteger(maxGroups) || maxGroups < 1 || maxGroups > 100) {
    throw new Error('maxGroups must be an integer from 1 to 100');
  }
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    const [identity] = await tx.$queryRaw<Array<{ database: string; schema: string }>>`
      SELECT current_database() AS database, current_schema() AS schema
    `;
    const pairs = await tx.$queryRaw<Array<{ bookingId: string; formId: string }>>`
      SELECT "bookingId", "formId" FROM "IntakeResponse"
      WHERE "supersededAt" IS NULL
      GROUP BY "bookingId", "formId" HAVING count(*) > 1
      ORDER BY "bookingId", "formId" LIMIT ${maxGroups + 1}
    `;
    const rows = pairs.length ? await tx.intakeResponse.findMany({
      where: { supersededAt: null, OR: pairs.slice(0, maxGroups) },
    }) : [];
    return { version: 1, ...identity, generatedAt: new Date().toISOString(),
      moreGroups: pairs.length > maxGroups, groups: buildManifestGroups(rows) };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 30_000 });
}
