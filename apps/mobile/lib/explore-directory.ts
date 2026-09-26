import type { Href } from 'expo-router';
import type { PackageFamily } from '@sawaa/shared/types';
import { getCategoryBookingServices } from '@sawaa/shared/catalog';

import type { ClinicEntry } from '@/lib/clinics';
import type { PublicCatalogRaw } from '@/services/client/catalog';
import type { PublicEmployeeItem } from '@/services/client/employees';
import type { Program } from '@/services/client/group-sessions';

export type ExploreKind = 'clinic' | 'service' | 'therapist' | 'package' | 'program';
export type ExploreFilter = 'all' | ExploreKind;

export interface ExploreResult {
  id: string;
  kind: ExploreKind;
  title: string;
  detail: string;
  searchText: string;
  route: Href;
}

interface ExploreData {
  clinics: ClinicEntry[];
  catalog: PublicCatalogRaw;
  therapists: PublicEmployeeItem[];
  packages: PackageFamily[];
  programs: Program[];
  locale: 'ar' | 'en';
}

function localized(ar: string | null | undefined, en: string | null | undefined, locale: 'ar' | 'en'): string {
  return (locale === 'ar' ? ar : en) ?? en ?? ar ?? '';
}

function visibleService(service: PublicCatalogRaw['services'][number]): boolean {
  return service.isHidden !== true && service.isActive !== false && service.archivedAt == null;
}

export function buildExploreResults(data: ExploreData): ExploreResult[] {
  const { clinics, catalog, therapists, packages, programs, locale } = data;
  const categories = new Map(catalog.categories.map((category) => [category.id, category]));
  const bookableClinicById = new Map(clinics.map((clinic) => [clinic.id, clinic]));
  const bookableServiceIds = new Set(therapists.flatMap((therapist) => therapist.serviceIds));
  const results: ExploreResult[] = [];

  for (const clinic of clinics) {
    const title = localized(clinic.nameAr, clinic.nameEn, locale);
    results.push({
      id: clinic.id,
      kind: 'clinic',
      title,
      detail: localized(clinic.nameAr, clinic.nameEn, locale),
      searchText: `${clinic.nameAr} ${clinic.nameEn ?? ''}`.toLocaleLowerCase(),
      route: { pathname: '/(client)/clinic/[id]', params: { id: clinic.id } },
    });
  }

  for (const service of catalog.services) {
    if (!visibleService(service) || !bookableServiceIds.has(service.id)) continue;
    const category = service.categoryId ? categories.get(service.categoryId) : undefined;
    if (service.categoryId && !category) continue;
    if (category && (category.isActive === false || category.archivedAt != null || category.bookingMode === 'DIRECT')) continue;
    if (category && !getCategoryBookingServices(category, catalog.services).some((entry) => entry.id === service.id)) continue;
    const clinic = category && (category.kind ?? 'CLINIC') === 'CLINIC'
      ? bookableClinicById.get(category.id)
      : undefined;
    const title = localized(service.nameAr, service.nameEn, locale);
    results.push({
      id: service.id,
      kind: 'service',
      title,
      detail: clinic ? localized(clinic.nameAr, clinic.nameEn, locale) : category ? localized(category.nameAr, category.nameEn, locale) : '',
      searchText: `${service.nameAr} ${service.nameEn ?? ''} ${category?.nameAr ?? ''} ${category?.nameEn ?? ''}`.toLocaleLowerCase(),
      route: { pathname: '/(client)/therapists', params: { ...(clinic ? { clinicId: clinic.id } : {}), serviceId: service.id } },
    });
  }

  for (const therapist of therapists) {
    const title = localized(therapist.nameAr, therapist.nameEn, locale);
    const specialty = localized(therapist.specialtyAr, therapist.specialty, locale);
    results.push({
      id: therapist.id,
      kind: 'therapist',
      title,
      detail: specialty,
      searchText: `${therapist.nameAr ?? ''} ${therapist.nameEn ?? ''} ${therapist.specialtyAr ?? ''} ${therapist.specialty ?? ''}`.toLocaleLowerCase(),
      route: { pathname: '/(client)/employee/[id]', params: { id: therapist.slug ?? therapist.id } },
    });
  }

  for (const family of packages) {
    if (family.isActive === false || family.isPublic === false || family.archivedAt != null) continue;
    const title = localized(family.nameAr, family.nameEn, locale);
    results.push({
      id: family.id,
      kind: 'package',
      title,
      detail: localized(family.descriptionAr, family.descriptionEn, locale),
      searchText: `${family.nameAr} ${family.nameEn ?? ''} ${family.descriptionAr ?? ''} ${family.descriptionEn ?? ''}`.toLocaleLowerCase(),
      route: { pathname: '/(client)/packages/[id]', params: { id: family.id } },
    });
  }

  for (const program of programs) {
    if (program.isPublic === false) continue;
    const title = localized(program.nameAr, program.nameEn, locale);
    results.push({
      id: program.id,
      kind: 'program',
      title,
      detail: localized(program.publicDescriptionAr, program.publicDescriptionEn, locale),
      searchText: `${program.nameAr} ${program.nameEn ?? ''} ${program.publicDescriptionAr ?? ''} ${program.publicDescriptionEn ?? ''}`.toLocaleLowerCase(),
      route: { pathname: '/(client)/groups/[id]', params: { id: program.id } },
    });
  }

  return results;
}

export function filterExploreResults(results: readonly ExploreResult[], filter: ExploreFilter, query: string): ExploreResult[] {
  const term = query.trim().toLocaleLowerCase();
  return results.filter((result) =>
    (filter === 'all' || result.kind === filter) && (!term || result.searchText.includes(term)),
  );
}
