import type { PackageFamily } from '@sawaa/shared/types';

import { packageHighlights } from '../packageHighlights';

const t = (key: string, options?: Record<string, unknown>) => `${key}:${JSON.stringify(options ?? {})}`;

function option(id: string, sessionCount: number, groups: NonNullable<PackageFamily['options'][number]['displayGroups']> = []) {
  return { id, sessionCount, displayGroups: groups } as unknown as PackageFamily['options'][number];
}

function family(options: PackageFamily['options']): PackageFamily {
  return { id: 'family', nameAr: 'باقة', isStandalone: false, options };
}

describe('packageHighlights', () => {
  it('returns nothing for a family without options', () => {
    expect(packageHighlights(family([]), true, t)).toEqual([]);
  });

  it('states only what holds for every option when there are several', () => {
    const lines = packageHighlights(family([option('a', 8), option('b', 4)]), true, t);
    expect(lines).toEqual([
      'packages.optionsCount:{"count":2}',
      'packages.sessionsFrom:{"count":4}',
    ]);
  });

  it('names the service and practitioner of a single option, deduplicated and localised', () => {
    const groups = [
      { key: 'a', serviceNameAr: 'إرشاد أسري', serviceNameEn: 'Family counselling', employeeName: 'سارة', sessions: [] },
      { key: 'b', serviceNameAr: 'إرشاد أسري', serviceNameEn: 'Family counselling', employeeName: 'سارة', sessions: [] },
    ];
    expect(packageHighlights(family([option('a', 6, groups)]), true, t)).toEqual([
      'packages.featureSessionsOf:{"count":6,"service":"إرشاد أسري"}',
      'packages.featurePractitioner:{"name":"سارة"}',
    ]);
    expect(packageHighlights(family([option('a', 6, groups)]), false, t)[0])
      .toBe('packages.featureSessionsOf:{"count":6,"service":"Family counselling"}');
  });

  it('falls back to the session count when the catalog gives no labels', () => {
    expect(packageHighlights(family([option('a', 3)]), true, t)).toEqual(['packages.sessionCount:{"count":3}']);
  });
});
