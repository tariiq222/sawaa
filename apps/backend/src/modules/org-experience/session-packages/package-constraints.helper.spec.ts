import { BadRequestException } from '@nestjs/common';
import { PackageConstraintDimension, PackageConstraintMode } from '@prisma/client';
import { normalizeItem } from './package-constraints.helper';
import type { CreateSessionPackageItemDto } from './create-session-package/create-session-package.dto';

const { SERVICE, PRACTITIONER, DURATION, DELIVERY_TYPE } = PackageConstraintDimension;
const { ANY, INCLUDE, EXCLUDE } = PackageConstraintMode;

const base = { paidQuantity: 4, freeQuantity: 0 };

const item = (over: Partial<CreateSessionPackageItemDto>): CreateSessionPackageItemDto =>
  ({ ...base, ...over }) as CreateSessionPackageItemDto;

describe('normalizeItem', () => {
  it('synthesises 3 INCLUDE constraints from a legacy triple (single-specific, price derivable)', () => {
    const n = normalizeItem(item({ serviceId: 'svc-1', employeeId: 'emp-1', durationOptionId: 'dur-1' }));
    expect(n.isSingleSpecific).toBe(true);
    expect(n.serviceId).toBe('svc-1');
    expect(n.unitPrice).toBeNull();
    expect(n.constraints).toHaveLength(3);
    expect(n.constraints.every((c) => c.mode === INCLUDE)).toBe(true);
  });

  it('accepts a flexible item (SERVICE INCLUDE + PRACTITIONER ANY) with a fixed unitPrice', () => {
    const n = normalizeItem(
      item({
        constraints: [
          { dimension: SERVICE, mode: INCLUDE, targetIds: ['svc-1'] },
          { dimension: PRACTITIONER, mode: ANY },
          { dimension: DURATION, mode: ANY },
        ],
        unitPrice: 20000,
      }),
    );
    expect(n.isSingleSpecific).toBe(false);
    expect(n.employeeId).toBeNull();
    expect(n.unitPrice).toBe(20000);
  });

  it('accepts EXCLUDE practitioners with a fixed unitPrice', () => {
    const n = normalizeItem(
      item({
        constraints: [
          { dimension: SERVICE, mode: INCLUDE, targetIds: ['svc-1'] },
          { dimension: PRACTITIONER, mode: EXCLUDE, targetIds: ['emp-9'] },
        ],
        unitPrice: 15000,
      }),
    );
    expect(n.isSingleSpecific).toBe(false);
    expect(n.constraints.find((c) => c.dimension === PRACTITIONER)?.mode).toBe(EXCLUDE);
  });

  it('rejects a flexible item without a unitPrice', () => {
    expect(() =>
      normalizeItem(
        item({ constraints: [{ dimension: SERVICE, mode: INCLUDE, targetIds: ['svc-1'] }, { dimension: PRACTITIONER, mode: ANY }] }),
      ),
    ).toThrow(BadRequestException);
  });

  it('rejects a duplicate constraint dimension', () => {
    expect(() =>
      normalizeItem(
        item({
          unitPrice: 100,
          constraints: [
            { dimension: SERVICE, mode: INCLUDE, targetIds: ['svc-1'] },
            { dimension: SERVICE, mode: EXCLUDE, targetIds: ['svc-2'] },
          ],
        }),
      ),
    ).toThrow(/Duplicate constraint dimension/);
  });

  it('rejects ANY with targets and INCLUDE/EXCLUDE without targets', () => {
    expect(() =>
      normalizeItem(item({ unitPrice: 100, constraints: [{ dimension: PRACTITIONER, mode: ANY, targetIds: ['emp-1'] }] })),
    ).toThrow(/must have no targets/);
    expect(() =>
      normalizeItem(item({ unitPrice: 100, constraints: [{ dimension: PRACTITIONER, mode: INCLUDE, targetIds: [] }] })),
    ).toThrow(/at least one target/);
  });

  it('rejects DURATION constrained when SERVICE is not a single specific service', () => {
    expect(() =>
      normalizeItem(
        item({
          unitPrice: 100,
          constraints: [
            { dimension: SERVICE, mode: ANY },
            { dimension: DURATION, mode: INCLUDE, targetIds: ['dur-1'] },
          ],
        }),
      ),
    ).toThrow(/DURATION can only be constrained/);
  });

  it('rejects an invalid DELIVERY_TYPE target', () => {
    expect(() =>
      normalizeItem(
        item({
          unitPrice: 100,
          constraints: [
            { dimension: SERVICE, mode: INCLUDE, targetIds: ['svc-1'] },
            { dimension: DELIVERY_TYPE, mode: INCLUDE, targetIds: ['TELEPORT'] },
          ],
        }),
      ),
    ).toThrow(/Invalid delivery type/);
  });

  it('rejects an item with neither constraints nor a full triple', () => {
    expect(() => normalizeItem(item({ serviceId: 'svc-1' }))).toThrow(BadRequestException);
  });
});
