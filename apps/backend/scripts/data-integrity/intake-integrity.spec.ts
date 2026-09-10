import { buildManifestGroups, intakeFingerprint } from './intake-manifest';
import { assertReviewedManifest } from './intake-apply';
import { applyIntakeManifest } from './intake-apply';

const row = (id: string, answers: object, createdAt = '2026-01-01T00:00:00Z') => ({
  id, bookingId: 'booking-a', formId: 'form-a', clientId: 'client-a',
  answers, createdAt: new Date(createdAt), supersededAt: null, supersededById: null,
});

describe('intake canonicalization manifest', () => {
  it('proposes the oldest identical response but never records approval automatically', () => {
    const groups = buildManifestGroups([
      row('z', { privateAnswer: ['yes', 'no'], other: 'x' }),
      row('a', { other: 'x', privateAnswer: ['yes', 'no'] }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ candidateId: 'a', requiresReview: false, canonicalId: null, reviewedBy: null });
    expect(JSON.stringify(groups)).not.toContain('privateAnswer');
    expect(JSON.stringify(groups)).not.toContain('client-a');
  });

  it('keeps differing answers unresolved, including differences in array order', () => {
    expect(buildManifestGroups([row('a', { q: ['a', 'b'] }), row('b', { q: ['b', 'a'] })])[0])
      .toMatchObject({ candidateId: null, requiresReview: true, canonicalId: null });
  });

  it('ignores singleton and superseded responses without rewriting them', () => {
    expect(buildManifestGroups([row('a', { q: 'a' }), { ...row('b', { q: 'b' }), supersededAt: new Date() }]))
      .toEqual([]);
  });

  it('detects changed identity and content but ignores object key order', () => {
    const original = row('a', { x: '1', y: '2' });
    expect(intakeFingerprint(original)).toBe(intakeFingerprint(row('a', { y: '2', x: '1' })));
    expect(intakeFingerprint(original)).not.toBe(intakeFingerprint({ ...original, clientId: 'changed' }));
    expect(intakeFingerprint(original)).not.toBe(intakeFingerprint(row('a', { x: '3', y: '2' })));
  });

  it('rejects missing reviewer, unresolved or foreign canonical IDs before opening a write transaction', () => {
    const group = buildManifestGroups([row('a', { q: 'a' }), row('b', { q: 'b' })])[0];
    const manifest = { version: 1 as const, database: 'isolated_test', schema: 'public', generatedAt: new Date().toISOString(), groups: [group] };
    expect(() => assertReviewedManifest(manifest)).toThrow('unresolved');
    expect(() => assertReviewedManifest({ ...manifest, groups: [{ ...group, canonicalId: 'foreign', reviewedBy: 'reviewer' }] })).toThrow('canonical');
    expect(() => assertReviewedManifest({ ...manifest, groups: [{ ...group, canonicalId: 'a', reviewedBy: ' ' }] })).toThrow('reviewer');
    expect(() => assertReviewedManifest({ ...manifest, groups: [{ ...group, canonicalId: 'a', reviewedBy: 'reviewer' }] })).not.toThrow();
  });

  it('emits the first committed receipt before a later transaction failure', async () => {
    const source = (bookingId: string, formId: string, id: string) => ({
      id, bookingId, formId, clientId: null, answers: { q: id },
      createdAt: new Date('2026-01-01T00:00:00Z'), supersededAt: null, supersededById: null,
    });
    const firstSources = [source('booking-a', 'form-a', 'a1'), source('booking-a', 'form-a', 'a2')];
    const secondSources = [source('booking-b', 'form-b', 'b1'), source('booking-b', 'form-b', 'b2')];
    const group = (rows: typeof firstSources) => ({
      bookingId: rows[0]!.bookingId,
      formId: rows[0]!.formId,
      sources: rows.map((row) => ({ id: row.id, fingerprint: intakeFingerprint(row), answersHash: '0'.repeat(64) })),
      candidateId: null, requiresReview: true, canonicalId: rows[0]!.id, reviewedBy: 'reviewer',
    });
    const manifest = {
      version: 1 as const, database: 'sawaa_test', schema: 'public',
      generatedAt: new Date().toISOString(), groups: [group(firstSources), group(secondSources)],
    };
    let transactionCount = 0;
    const tx = {
      $queryRaw: jest.fn()
        .mockResolvedValueOnce([{ database: 'sawaa_test', schema: 'public' }])
        .mockResolvedValueOnce([{ id: 'booking-a' }])
        .mockResolvedValueOnce([{ id: 'form-a' }]),
      $executeRaw: jest.fn().mockResolvedValue(0),
      intakeResponse: {
        findMany: jest.fn().mockResolvedValue(firstSources),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ database: 'sawaa_test', schema: 'public' }]),
      $transaction: jest.fn(async (fn: (transaction: unknown) => Promise<unknown>) => {
        transactionCount += 1;
        if (transactionCount === 2) throw new Error('synthetic later transaction failure');
        return fn(tx);
      }),
    };
    const onReceipt = jest.fn<Promise<void>, [unknown]>().mockResolvedValue(undefined);

    await expect(applyIntakeManifest(prisma as never, manifest, {
      expectedDatabase: 'sawaa_test', oldWritersDrained: true, onReceipt,
    })).rejects.toThrow('synthetic later transaction failure');
    expect(onReceipt).toHaveBeenCalledTimes(1);
    expect(onReceipt.mock.calls[0]![0]).toMatchObject({ bookingId: 'booking-a', status: 'applied' });
  });
});
