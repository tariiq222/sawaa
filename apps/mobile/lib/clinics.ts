import { selectBookableClinicEntries } from '@sawaa/shared/catalog';
import type { PublicCatalogRaw } from '@/services/client/catalog';
import type { PublicEmployeeItem } from '@/services/client/employees';

export interface ClinicEntry {
  id: string;
  nameAr: string;
  nameEn: string | null;
  therapistCount: number;
  serviceCount: number;
  serviceIds: string[];
  bookingMode: 'DIRECT' | 'SERVICES';
  directServiceId: string | null;
}

/** See docs/architecture/clinic-service-booking-contract.md. */
export function deriveClinics(
  catalog: PublicCatalogRaw,
  therapists: Pick<PublicEmployeeItem, 'serviceIds' | 'isBookable'>[],
): ClinicEntry[] {
  return selectBookableClinicEntries(catalog, therapists).map(({ category, ...entry }) => ({
    id: category.id,
    nameAr: category.nameAr,
    nameEn: category.nameEn,
    ...entry,
  }));
}
