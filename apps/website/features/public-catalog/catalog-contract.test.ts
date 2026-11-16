import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import type { PublicCatalog, PublicDepartment, PublicService, PublicServiceCategory } from './types';

/**
 * Drift guard for the hand-maintained website mirror of the public catalog
 * response (MNT-08). The website has no generated-types artifact of its own, so
 * this test reads the committed OpenAPI snapshot and fails when the documented
 * `required` sets stop matching `features/public-catalog/types.ts`.
 *
 * It compares KEY SETS only. The local type legitimately keeps a few keys that
 * the snapshot does not require, because the runtime code reads them
 * defensively and they are NOT sent by these GET handlers today:
 *   - `vatRate` may be missing from an older cached response (`?? 0`).
 *   - `PublicServiceCategory.archivedAt`, `PublicService.isActive` and
 *     `PublicService.archivedAt` are read as `!== false` / `== null` guards in
 *     `bookable-services.ts` / `booking-catalog.ts`. The backend already filters
 *     those rows out, so the guards are inert — they are retained to keep the
 *     shared, framework-agnostic selectors tolerant of any legacy payload and
 *     produce the identical runtime result. Removing them is a separate cleanup
 *     with its own proof; this unit does not change runtime behaviour.
 */

type Schemas = Record<string, { required?: string[]; properties?: Record<string, unknown> }>;

const spec = JSON.parse(
  readFileSync(path.resolve(__dirname, '../../../../apps/backend/openapi.json'), 'utf8'),
) as { components: { schemas: Schemas } };

const schema = (name: string) => {
  const found = spec.components.schemas[name];
  if (!found) throw new Error(`Missing OpenAPI schema ${name}`);
  return found;
};

/** Required keys of a type, excluding the intentionally-tolerant ones. */
type KeysOf<T> = Extract<keyof T, string>;

function expectSameKeys(
  documented: string[],
  local: readonly string[],
  localExtras: readonly string[],
) {
  const documentedSet = new Set(documented);
  const localSet = new Set(local);
  for (const key of localSet) {
    if (localExtras.includes(key)) continue;
    expect(documentedSet.has(key), `local key "${key}" is not documented`).toBe(true);
  }
  for (const key of documentedSet) {
    expect(localSet.has(key), `documented key "${key}" is missing locally`).toBe(true);
  }
}

function documentedKeys(name: string): string[] {
  return Object.keys(schema(name).properties ?? {});
}

describe('public catalog types mirror the OpenAPI snapshot', () => {
  it('PublicCatalogDto', () => {
    const local: KeysOf<PublicCatalog>[] = ['departments', 'categories', 'services', 'vatRate'];
    expectSameKeys(documentedKeys('PublicCatalogDto'), local, []);
  });

  it('CatalogDepartmentDto', () => {
    const local: KeysOf<PublicDepartment>[] = [
      'id', 'nameAr', 'nameEn', 'descriptionAr', 'descriptionEn', 'icon',
      'sortOrder', 'isVisible', 'isActive', 'createdAt', 'updatedAt',
    ];
    expectSameKeys(documentedKeys('CatalogDepartmentDto'), local, []);
    expect(schema('CatalogDepartmentDto').required?.sort()).toEqual([...local].sort());
  });

  it('CatalogCategoryDto', () => {
    const local: KeysOf<PublicServiceCategory>[] = [
      'id', 'ref', 'departmentId', 'nameAr', 'nameEn', 'sortOrder', 'isActive',
      'bookingMode', 'kind', 'archivedAt', 'imageUrl', 'iconName', 'iconBgColor',
      'createdAt', 'updatedAt',
    ];
    expectSameKeys(documentedKeys('CatalogCategoryDto'), local, ['archivedAt']);
    // `archivedAt` is a defensive read only: the handler's filter excludes archived rows.
    expect(documentedKeys('CatalogCategoryDto')).not.toContain('archivedAt');
  });

  it('CatalogServiceDto', () => {
    const local: KeysOf<PublicService>[] = [
      'id', 'categoryId', 'isHidden', 'isActive', 'archivedAt', 'nameAr', 'nameEn',
      'descriptionAr', 'descriptionEn', 'durationMins', 'price', 'currency',
      'imageUrl', 'iconName', 'iconBgColor', 'showPrice', 'showDuration',
      'durationOptions', 'bookingConfigs',
    ];
    expectSameKeys(documentedKeys('CatalogServiceDto'), local, ['isActive', 'archivedAt']);
    // `isActive`/`archivedAt` are defensive reads only: the handler filters both.
    expect(documentedKeys('CatalogServiceDto')).not.toContain('isActive');
    expect(documentedKeys('CatalogServiceDto')).not.toContain('archivedAt');
    // `categoryId` is nullable in Prisma (`String?`) and the handler selects it.
    expect(schema('CatalogServiceDto').properties).toHaveProperty('categoryId');
  });

  it('CatalogServiceDurationOptionDto label is non-null in the schema', () => {
    expect(schema('CatalogServiceDurationOptionDto').required).toContain('label');
  });

  it('PublicBranchListItemDto matches the api-client PublicBranch interface', () => {
    expect(schema('PublicBranchListItemDto').required?.sort()).toEqual(
      ['addressAr', 'city', 'id', 'isMain', 'nameAr', 'nameEn'].sort(),
    );
  });
});
