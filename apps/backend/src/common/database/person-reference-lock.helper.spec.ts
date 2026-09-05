import { BadRequestException, NotFoundException } from '@nestjs/common';
import { lockPersonReferences } from './person-reference-lock.helper';

type RawCall = [TemplateStringsArray, ...unknown[]];

function sqlText(call: RawCall): string {
  return call[0].join('?').replace(/\s+/g, ' ').trim();
}

function buildTx(rowsById: Record<string, unknown> = {}) {
  return {
    $queryRaw: jest.fn(async (_strings: TemplateStringsArray, id: string) => {
      const row = rowsById[id];
      return row ? [row] : [];
    }),
  };
}

describe('lockPersonReferences', () => {
  it('deduplicates and locks deterministically by Client, Employee, then id', async () => {
    const tx = buildTx({
      'client-a': { id: 'client-a', isActive: true, deletedAt: null },
      'client-z': { id: 'client-z', isActive: true, deletedAt: null },
      'employee-a': { id: 'employee-a', isActive: true },
      'employee-z': { id: 'employee-z', isActive: true },
    });

    await lockPersonReferences(
      tx as never,
      [
        { kind: 'Employee', id: 'employee-z' },
        { kind: 'Client', id: 'client-z' },
        { kind: 'Employee', id: 'employee-a' },
        { kind: 'Client', id: 'client-a' },
        { kind: 'Client', id: 'client-a' },
      ],
      'reference',
    );

    expect(tx.$queryRaw.mock.calls.map((call) => call[1])).toEqual([
      'client-a',
      'client-z',
      'employee-a',
      'employee-z',
    ]);
    expect(
      tx.$queryRaw.mock.calls.map((call) => sqlText(call as RawCall)),
    ).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/FROM "Client".*FOR SHARE/),
        expect.stringMatching(/FROM "Employee".*FOR SHARE/),
      ]),
    );
  });

  it('uses FOR UPDATE in delete mode without rejecting an inactive row', async () => {
    const tx = buildTx({
      employee: { id: 'employee', isActive: false },
    });

    await lockPersonReferences(
      tx as never,
      [{ kind: 'Employee', id: 'employee' }],
      'delete',
    );

    expect(sqlText(tx.$queryRaw.mock.calls[0] as RawCall)).toMatch(
      /FROM "Employee".*FOR UPDATE/,
    );
  });

  it('rejects a missing or soft-deleted person in reference mode', async () => {
    const missing = buildTx();
    await expect(
      lockPersonReferences(
        missing as never,
        [{ kind: 'Employee', id: 'missing' }],
        'reference',
      ),
    ).rejects.toThrow(NotFoundException);

    const deleted = buildTx({
      deleted: { id: 'deleted', isActive: false, deletedAt: new Date() },
    });
    await expect(
      lockPersonReferences(
        deleted as never,
        [{ kind: 'Client', id: 'deleted' }],
        'reference',
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects an inactive client or employee in reference mode', async () => {
    const tx = buildTx({
      client: { id: 'client', isActive: false, deletedAt: null },
      employee: { id: 'employee', isActive: false },
    });

    await expect(
      lockPersonReferences(
        tx as never,
        [{ kind: 'Client', id: 'client' }],
        'reference',
      ),
    ).rejects.toThrow(BadRequestException);
    await expect(
      lockPersonReferences(
        tx as never,
        [{ kind: 'Employee', id: 'employee' }],
        'reference',
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
