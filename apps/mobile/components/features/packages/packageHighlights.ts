import type { PackageFamily } from '@sawaa/shared/types';

type Translate = (key: string, options?: Record<string, unknown>) => string;

const unique = (values: string[]) => [...new Set(values.filter((value) => value.trim().length > 0))];

/**
 * Feature lines for a package card, built only from fields the public catalog
 * returns (option count, session counts, service and practitioner names).
 * Validity period and clinic scope are not part of the payload, so no line
 * mentions them. A family with several options only states what holds for all.
 */
export function packageHighlights(family: PackageFamily, isRTL: boolean, t: Translate): string[] {
  const { options } = family;
  if (options.length === 0) return [];
  if (options.length > 1) {
    const fewest = Math.min(...options.map((option) => option.sessionCount));
    return [
      t('packages.optionsCount', { count: options.length }),
      t('packages.sessionsFrom', { count: fewest }),
    ];
  }
  const [option] = options;
  const separator = isRTL ? '، ' : ', ';
  const groups = option.displayGroups ?? [];
  const services = unique(groups.map((group) => (isRTL ? group.serviceNameAr : group.serviceNameEn ?? group.serviceNameAr)));
  const practitioners = unique(groups.map((group) => group.employeeName));
  return [
    services.length > 0
      ? t('packages.featureSessionsOf', { count: option.sessionCount, service: services.join(separator) })
      : t('packages.sessionCount', { count: option.sessionCount }),
    ...(practitioners.length > 0 ? [t('packages.featurePractitioner', { name: practitioners.join(separator) })] : []),
  ];
}
