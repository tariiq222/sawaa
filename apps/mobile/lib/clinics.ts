import { findDepartment } from '@sawaa/shared/catalog';
import type { PublicCatalogRaw } from '@/services/client/catalog';
import type { PublicEmployeeItem } from '@/services/client/employees';

export interface ClinicEntry {
  id: string;
  nameAr: string;
  nameEn: string | null;
  therapistCount: number;
  serviceCount: number;
  serviceIds: string[];
}

/** Website-parity clinic derivation: categories of the "عيادات" department that
 *  have at least one service and one bookable therapist. */
export function deriveClinics(
  catalog: PublicCatalogRaw,
  therapists: Pick<PublicEmployeeItem, 'serviceIds' | 'isBookable'>[],
): ClinicEntry[] {
  const clinicsDept = findDepartment(catalog.departments, { ar: ['عيادات'], en: ['clinic'] });
  if (!clinicsDept) return [];
  const bookable = therapists.filter((t) => t.isBookable);

  return catalog.categories
    .filter((c) => c.departmentId === clinicsDept.id)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((c) => {
      const serviceIds = catalog.services.filter((s) => s.categoryId === c.id).map((s) => s.id);
      const serviceIdSet = new Set(serviceIds);
      const therapistCount = bookable.filter((t) => t.serviceIds.some((id) => serviceIdSet.has(id))).length;
      return { id: c.id, nameAr: c.nameAr, nameEn: c.nameEn, therapistCount, serviceCount: serviceIds.length, serviceIds };
    })
    .filter((c) => c.serviceCount > 0 && c.therapistCount > 0);
}
