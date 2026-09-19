import type { PackageOfferSnapshot } from '@sawaa/shared/types';

export function buildPackageOfferSnapshot(pkg: any): PackageOfferSnapshot | null {
  const family = pkg.family;
  if (!pkg.familyId || !family) return null;
  const sessionCount = (pkg.groups ?? []).reduce((total: number, group: any) => total + (group.items?.length ?? 0), 0) ||
    (pkg.items ?? []).reduce((total: number, item: any) => total + Number(item.paidQuantity ?? 0) + Number(item.freeQuantity ?? 0), 0);
  return {
    familyId: pkg.familyId,
    familyNameAr: family.nameAr,
    familyNameEn: family.nameEn ?? null,
    optionNameAr: pkg.nameAr,
    optionNameEn: pkg.nameEn ?? null,
    sessionCount,
  };
}

export function parsePackageOfferSnapshot(value: unknown): PackageOfferSnapshot | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  if (typeof row.familyId !== 'string' || typeof row.familyNameAr !== 'string' || typeof row.optionNameAr !== 'string' || typeof row.sessionCount !== 'number') return null;
  return {
    familyId: row.familyId,
    familyNameAr: row.familyNameAr,
    familyNameEn: typeof row.familyNameEn === 'string' ? row.familyNameEn : null,
    optionNameAr: row.optionNameAr,
    optionNameEn: typeof row.optionNameEn === 'string' ? row.optionNameEn : null,
    sessionCount: row.sessionCount,
  };
}
