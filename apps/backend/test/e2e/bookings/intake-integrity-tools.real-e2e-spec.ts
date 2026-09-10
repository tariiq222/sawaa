/**
 * T4 intake manifest/apply acceptance against the dedicated real Postgres
 * lane. The test deliberately creates only synthetic UUID fixtures and cleans
 * those fixture IDs after every scenario.
 */
import { createHash, randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { BookingStatus, DeliveryType, Prisma, PrismaClient } from '@prisma/client';
import { createIntakeManifest, type IntakeManifest } from '../../../scripts/data-integrity/intake-manifest';
import { applyIntakeManifest } from '../../../scripts/data-integrity/intake-apply';
import { SubmitIntakeResponseHandler } from '../../../src/modules/org-experience/submit-intake-response/submit-intake-response.handler';
import { PrismaService } from '../../../src/infrastructure/database';
import { createRealE2eApp } from '../../helpers/create-real-e2e-app';

const requestedAsExplicitFile = process.argv.some((argument) =>
  argument.includes('intake-integrity-tools.real-e2e-spec.ts'),
);
if (!process.env.REAL_E2E_DATABASE_URL && (requestedAsExplicitFile || process.env.REAL_E2E_REQUIRED === '1')) {
  throw new Error('REAL_E2E_DATABASE_URL is required for the explicit intake integrity real-DB lane.');
}

const describeRealE2e = process.env.REAL_E2E_DATABASE_URL ? describe : describe.skip;

type Fixture = { bookingId: string; formId: string; fieldId: string; responseIds: string[] };
type RowState = { id: string; answers: unknown; supersededAt: Date | null; supersededById: string | null };

describeRealE2e('T4 intake integrity tools (real e2e)', () => {
  jest.setTimeout(90_000);

  let app: Awaited<ReturnType<typeof createRealE2eApp>>['app'];
  let prisma: PrismaService;
  let observer: PrismaClient;

  const databaseUrl = () => process.env.REAL_E2E_DATABASE_URL!;
  const namedUrl = (name: string) => {
    const url = new URL(databaseUrl());
    url.searchParams.set('application_name', name);
    return url.toString();
  };
  const client = (name: string) => new PrismaClient({
    adapter: new PrismaPg({ connectionString: namedUrl(name) }),
  });
  const queryLoggingClient = (name: string) => new PrismaClient({
    adapter: new PrismaPg({ connectionString: namedUrl(name) }),
    log: [{ emit: 'event', level: 'query' }],
  });

  const createFixture = async (label: string, duplicateCount = 2): Promise<Fixture> => {
    const bookingId = randomUUID();
    const formId = randomUUID();
    const fieldId = randomUUID();
    const suffix = `${label}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
    await prisma.intakeForm.create({
      data: { id: formId, nameAr: `اختبار T4 ${suffix}`, type: 'PRE_SESSION', scope: 'GLOBAL' },
    });
    await prisma.intakeField.create({
      data: { id: fieldId, formId, labelAr: 'إجابة الاختبار', fieldType: 'TEXT', isRequired: true, position: 0 },
    });
    await prisma.booking.create({
      data: {
        id: bookingId,
        branchId: randomUUID(),
        clientId: randomUUID(),
        employeeId: randomUUID(),
        serviceId: randomUUID(),
        bookingType: 'INDIVIDUAL',
        deliveryType: DeliveryType.IN_PERSON,
        status: BookingStatus.EXPIRED,
        scheduledAt: new Date(Date.now() + 86_400_000),
        endsAt: new Date(Date.now() + 90_000_000),
        durationMins: 60,
        price: 0,
        bookingNumber: 1_100_000_000 + Math.floor(Math.random() * 700_000_000),
      },
    });
    const responseIds: string[] = [];
    for (let index = 0; index < duplicateCount; index += 1) {
      const response = await prisma.intakeResponse.create({
        data: {
          bookingId,
          formId,
          answers: { [fieldId]: index === 1 && label.includes('different') ? 'إجابة ثانية' : 'إجابة ثابتة' },
          createdAt: new Date(Date.now() - (duplicateCount - index) * 1_000),
        },
        select: { id: true },
      });
      responseIds.push(response.id);
    }
    return { bookingId, formId, fieldId, responseIds };
  };

  const cleanupFixture = async (fixture: Fixture) => {
    await prisma.intakeResponseRevision.deleteMany({ where: { bookingId: fixture.bookingId } });
    await prisma.intakeResponse.deleteMany({ where: { bookingId: fixture.bookingId } });
    await prisma.booking.deleteMany({ where: { id: fixture.bookingId } });
    await prisma.intakeForm.deleteMany({ where: { id: fixture.formId } });
  };

  const rowState = async (db: PrismaClient | PrismaService, bookingId: string): Promise<RowState[]> => {
    const rows = await db.intakeResponse.findMany({
      where: { bookingId },
      orderBy: { id: 'asc' },
      select: { id: true, answers: true, supersededAt: true, supersededById: true },
    });
    return rows;
  };

  const rawAnswersDigest = (rows: RowState[]) => createHash('sha256')
    .update(JSON.stringify(rows.map((row) => [row.id, row.answers])))
    .digest('hex');

  const groupFor = (manifest: IntakeManifest, fixture: Fixture) => {
    const group = manifest.groups.find((candidate) =>
      candidate.bookingId === fixture.bookingId && candidate.formId === fixture.formId,
    );
    if (!group) throw new Error('Synthetic fixture was missing from the manifest');
    return group;
  };

  const scopedManifest = (manifest: IntakeManifest, fixture: Fixture): IntakeManifest => ({
    ...manifest,
    groups: [groupFor(manifest, fixture)],
  });

  const approvedManifest = (manifest: IntakeManifest, fixture: Fixture, canonicalId = fixture.responseIds[0]): IntakeManifest => ({
    ...manifest,
    groups: manifest.groups.map((group) => group.bookingId === fixture.bookingId && group.formId === fixture.formId
      ? { ...group, canonicalId, reviewedBy: 'synthetic-owner-reviewer' }
      : group),
  });

  const submitHandler = (db: PrismaClient) => new SubmitIntakeResponseHandler(
    db as never,
    { withTransaction: <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) => db.$transaction(fn) } as never,
  );

  const waitForLockWait = async (names: string[]) => {
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      const rows = await observer.$queryRaw<Array<{ application_name: string }>>`
        SELECT application_name
        FROM pg_stat_activity
        WHERE application_name IN (${Prisma.join(names)}) AND wait_event_type = 'Lock'
      `;
      if (new Set(rows.map((row) => row.application_name)).size >= names.length) return;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error(`Expected synthetic lock waits for ${names.join(', ')}`);
  };

  const holdPairLock = async (db: PrismaClient, fixture: Fixture) => {
    let readyResolve!: () => void;
    let releaseResolve!: () => void;
    const ready = new Promise<void>((resolve) => { readyResolve = resolve; });
    const release = new Promise<void>((resolve) => { releaseResolve = resolve; });
    const transaction = db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`intake:${fixture.bookingId}:${fixture.formId}`}, 0))`;
      readyResolve();
      await release;
    });
    await ready;
    return { transaction, release: releaseResolve };
  };

  beforeAll(async () => {
    const result = await createRealE2eApp();
    app = result.app;
    prisma = result.prisma;
    observer = client('t4-observer');
    await observer.$connect();
  });

  afterAll(async () => {
    await app?.close();
    await observer?.$disconnect();
  });

  it('generates a read-only bounded manifest for identical and differing groups', async () => {
    const identical = await createFixture('identical');
    const different = await createFixture('different');
    const logged = queryLoggingClient('t4-manifest-readonly');
    const queries: string[] = [];
    logged.$on('query', (event) => queries.push(event.query));
    try {
      await logged.$connect();
      const before = await Promise.all([rowState(prisma, identical.bookingId), rowState(prisma, different.bookingId)]);
      const manifest = await createIntakeManifest(logged, 100);
      const after = await Promise.all([rowState(prisma, identical.bookingId), rowState(prisma, different.bookingId)]);
      const identicalGroup = groupFor(manifest, identical);
      const differentGroup = groupFor(manifest, different);
      expect(identicalGroup).toMatchObject({ candidateId: identical.responseIds[0], requiresReview: false, canonicalId: null, reviewedBy: null });
      expect(differentGroup).toMatchObject({ candidateId: null, requiresReview: true, canonicalId: null, reviewedBy: null });
      expect(after.map(rawAnswersDigest)).toEqual(before.map(rawAnswersDigest));
      expect(queries.some((query) => /\b(insert|update|delete|truncate|alter|drop)\b/i.test(query))).toBe(false);
    } finally {
      await logged.$disconnect();
      await cleanupFixture(identical);
      await cleanupFixture(different);
    }
  });

  it('refuses unresolved, wrong-database, and undrained-writer apply attempts', async () => {
    const fixture = await createFixture('refusals');
    const db = client('t4-refusals');
    try {
      await db.$connect();
      const manifest = await createIntakeManifest(db);
      const unresolved = groupFor(manifest, fixture);
      const scoped = scopedManifest(manifest, fixture);
      expect(unresolved.canonicalId).toBeNull();
      await expect(applyIntakeManifest(db, scoped, {
        expectedDatabase: manifest.database,
        oldWritersDrained: true,
      })).rejects.toThrow('unresolved');
      const approved = approvedManifest(scoped, fixture);
      await expect(applyIntakeManifest(db, approved, {
        expectedDatabase: `${manifest.database}-wrong`,
        oldWritersDrained: true,
      })).rejects.toThrow('does not match manifest');
      await expect(applyIntakeManifest(db, approved, {
        expectedDatabase: manifest.database,
        oldWritersDrained: false,
      })).rejects.toThrow('writers must be drained');
      const wrongConnectedEmpty = { ...manifest, database: `${manifest.database}-wrong`, groups: [] };
      await expect(applyIntakeManifest(db, wrongConnectedEmpty, {
        expectedDatabase: wrongConnectedEmpty.database,
        oldWritersDrained: true,
      })).rejects.toThrow('Connected database does not match reviewed manifest');
      expect((await rowState(prisma, fixture.bookingId)).every((row) => row.supersededAt === null)).toBe(true);
    } finally {
      await db.$disconnect();
      await cleanupFixture(fixture);
    }
  });

  it('applies approved synthetic groups without changing raw answers and is idempotent', async () => {
    const identical = await createFixture('approved-identical');
    const different = await createFixture('approved-different');
    const db = client('t4-apply');
    try {
      await db.$connect();
      const manifest = await createIntakeManifest(db);
      const approved = approvedManifest({
        ...manifest,
        groups: [groupFor(manifest, identical), groupFor(manifest, different)],
      }, identical);
      const approvedAll: IntakeManifest = {
        ...approved,
        groups: [
          { ...groupFor(manifest, identical), canonicalId: identical.responseIds[0], reviewedBy: 'synthetic-owner-reviewer' },
          { ...groupFor(manifest, different), canonicalId: different.responseIds[0], reviewedBy: 'synthetic-owner-reviewer' },
        ],
      };
      const before = await Promise.all([rowState(prisma, identical.bookingId), rowState(prisma, different.bookingId)]);
      const first = await applyIntakeManifest(db, approvedAll, { expectedDatabase: manifest.database, oldWritersDrained: true });
      const afterFirst = await Promise.all([rowState(prisma, identical.bookingId), rowState(prisma, different.bookingId)]);
      expect(first.map((receipt) => receipt.status)).toEqual(['applied', 'applied']);
      expect(afterFirst.map(rawAnswersDigest)).toEqual(before.map(rawAnswersDigest));
      expect(afterFirst.map((rows) => rows.filter((row) => row.supersededAt === null))).toEqual([
        [expect.objectContaining({ id: identical.responseIds[0] })],
        [expect.objectContaining({ id: different.responseIds[0] })],
      ]);
      const second = await applyIntakeManifest(db, approvedAll, { expectedDatabase: manifest.database, oldWritersDrained: true });
      expect(second.map((receipt) => receipt.status)).toEqual(['alreadyApplied', 'alreadyApplied']);
      expect(await Promise.all([rowState(prisma, identical.bookingId), rowState(prisma, different.bookingId)])).toEqual(afterFirst);
    } finally {
      await db.$disconnect();
      await cleanupFixture(identical);
      await cleanupFixture(different);
    }
  });

  it('reports changed fingerprints and a newly inserted current row as conflicts', async () => {
    const changed = await createFixture('changed-fingerprint');
    const added = await createFixture('new-current');
    const db = client('t4-conflicts');
    try {
      await db.$connect();
      const changedManifest = await createIntakeManifest(db);
      const addedManifest = await createIntakeManifest(db);
      await prisma.intakeResponse.update({ where: { id: changed.responseIds[0] }, data: { clientId: randomUUID() } });
      const changedBefore = await rowState(prisma, changed.bookingId);
      const changedResult = await applyIntakeManifest(db, approvedManifest(scopedManifest(changedManifest, changed), changed), {
        expectedDatabase: changedManifest.database, oldWritersDrained: true,
      });
      expect(changedResult[0]?.status).toBe('conflict');
      expect(await rowState(prisma, changed.bookingId)).toEqual(changedBefore);
      await prisma.intakeResponse.create({
        data: { bookingId: added.bookingId, formId: added.formId, answers: { [added.fieldId]: 'ثالثة' } },
      });
      const addedResult = await applyIntakeManifest(db, approvedManifest(scopedManifest(addedManifest, added), added), {
        expectedDatabase: addedManifest.database, oldWritersDrained: true,
      });
      expect(addedResult[0]?.status).toBe('conflict');
      expect((await rowState(prisma, added.bookingId)).filter((row) => row.supersededAt === null)).toHaveLength(3);
    } finally {
      await db.$disconnect();
      await cleanupFixture(changed);
      await cleanupFixture(added);
    }
  });

  it('returns a conflict without mutation when a reviewed response has no Booking parent', async () => {
    const fixture = await createFixture('orphan-booking');
    const db = client('t4-orphan');
    try {
      await db.$connect();
      const manifest = await createIntakeManifest(db);
      const approved = approvedManifest(scopedManifest(manifest, fixture), fixture);
      await prisma.booking.delete({ where: { id: fixture.bookingId } });
      const before = await rowState(prisma, fixture.bookingId);
      const result = await applyIntakeManifest(db, approved, {
        expectedDatabase: manifest.database, oldWritersDrained: true,
      });
      expect(result[0]?.status).toBe('conflict');
      expect(await rowState(prisma, fixture.bookingId)).toEqual(before);
    } finally {
      await db.$disconnect();
      await cleanupFixture(fixture);
    }
  });

  it('preserves committed earlier receipts when a later receipt callback fails and retries as alreadyApplied', async () => {
    const first = await createFixture('receipt-first');
    const second = await createFixture('receipt-second');
    const db = client('t4-receipts');
    try {
      await db.$connect();
      const manifest = await createIntakeManifest(db);
      const approved: IntakeManifest = {
        ...manifest,
        groups: [
          { ...groupFor(manifest, first), canonicalId: first.responseIds[0], reviewedBy: 'synthetic-owner-reviewer' },
          { ...groupFor(manifest, second), canonicalId: second.responseIds[0], reviewedBy: 'synthetic-owner-reviewer' },
        ],
      };
      const persisted: string[] = [];
      let callbackCount = 0;
      await expect(applyIntakeManifest(db, approved, {
        expectedDatabase: manifest.database,
        oldWritersDrained: true,
        onReceipt: async (receipt) => {
          if (callbackCount++ === 1) throw new Error('synthetic later-group receipt failure');
          persisted.push(JSON.stringify(receipt));
        },
      })).rejects.toThrow('synthetic later-group receipt failure');
      expect(persisted).toHaveLength(1);
      expect(JSON.parse(persisted[0]!)).toMatchObject({ bookingId: first.bookingId, status: 'applied' });
      const retry = await applyIntakeManifest(db, approved, {
        expectedDatabase: manifest.database, oldWritersDrained: true,
      });
      expect(retry.map((receipt) => receipt.status)).toEqual(['alreadyApplied', 'alreadyApplied']);
    } finally {
      await db.$disconnect();
      await cleanupFixture(first);
      await cleanupFixture(second);
    }
  });

  it('serializes actual submit and apply operations in both lock acquisition orders', async () => {
    const runOrder = async (first: 'apply' | 'submit') => {
      const fixture = await createFixture(`serialization-${first}`);
      const holder = client(`t4-holder-${first}`);
      const firstDb = client(`t4-first-${first}`);
      const secondDb = client(`t4-second-${first}`);
      try {
        await Promise.all([holder.$connect(), firstDb.$connect(), secondDb.$connect()]);
        const manifest = await createIntakeManifest(firstDb);
        const approved = approvedManifest(scopedManifest(manifest, fixture), fixture);
        const held = await holdPairLock(holder, fixture);
        const operation = (name: 'apply' | 'submit', db: PrismaClient) => name === 'apply'
          ? applyIntakeManifest(db, approved, { expectedDatabase: manifest.database, oldWritersDrained: true })
          : submitHandler(db).execute({ bookingId: fixture.bookingId, formId: fixture.formId, answers: { [fixture.fieldId]: 'إجابة لاحقة' } });
        const firstPromise = operation(first, firstDb);
        await waitForLockWait([`t4-first-${first}`]);
        const secondPromise = operation(first === 'apply' ? 'submit' : 'apply', secondDb);
        await waitForLockWait([`t4-first-${first}`, `t4-second-${first}`]);
        held.release();
        const results = await Promise.allSettled([firstPromise, secondPromise]);
        await held.transaction;
        if (first === 'apply') {
          expect(results[0]?.status).toBe('fulfilled');
          expect(results[1]?.status).toBe('fulfilled');
        } else {
          expect(results[0]?.status).toBe('rejected');
          expect((results[0] as PromiseRejectedResult).reason).toMatchObject({ status: 409 });
          expect(results[1]?.status).toBe('fulfilled');
        }
        expect((await rowState(prisma, fixture.bookingId)).filter((row) => row.supersededAt === null)).toHaveLength(1);
      } finally {
        await Promise.all([holder.$disconnect(), firstDb.$disconnect(), secondDb.$disconnect()]);
        await cleanupFixture(fixture);
      }
    };

    await runOrder('apply');
    await runOrder('submit');
  });
});
