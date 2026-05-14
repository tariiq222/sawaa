import type { PublicEmployeeItem } from '@/services/client/employees';

export type TherapistChip = 'available' | 'women' | 'remote' | 'under300' | null;

export function applyTherapistFilters(
  list: PublicEmployeeItem[],
  query: string,
  chip: TherapistChip,
): PublicEmployeeItem[] {
  let result = list;

  const q = query.trim().toLowerCase();
  if (q) {
    result = result.filter(
      (e) =>
        e.nameAr?.toLowerCase().includes(q) ||
        e.nameEn?.toLowerCase().includes(q) ||
        e.specialty?.toLowerCase().includes(q) ||
        e.specialtyAr?.toLowerCase().includes(q),
    );
  }

  switch (chip) {
    case 'available':
      result = result.filter((e) => e.isAvailableToday);
      break;
    case 'women':
      result = result.filter((e) => e.gender === 'FEMALE');
      break;
    case 'remote':
      result = result.filter((e) => e.employmentType === 'REMOTE');
      break;
    case 'under300':
      result = result.filter((e) => e.minServicePrice !== null && e.minServicePrice < 300);
      break;
  }

  return result;
}
