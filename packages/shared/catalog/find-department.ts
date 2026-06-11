export interface DepartmentKeywords {
  /** Arabic substrings — matches when `nameAr` contains any of them. */
  ar: string[];
  /** English substrings — matches when `nameEn` contains any of them (case-insensitive). */
  en: string[];
}

export interface DepartmentNameLike {
  nameAr: string;
  nameEn?: string | null;
}

/**
 * Finds a department by keyword instead of exact name. Department names differ
 * between environments (e.g. local "عيادات سواء" vs production "عيادات"), so
 * exact-match lookups silently find nothing in one of them.
 */
export function findDepartment<T extends DepartmentNameLike>(
  departments: T[],
  keywords: DepartmentKeywords,
): T | undefined {
  return departments.find((d) => {
    if (keywords.ar.some((kw) => d.nameAr.includes(kw))) return true;
    const nameEn = d.nameEn?.toLowerCase();
    if (!nameEn) return false;
    return keywords.en.some((kw) => nameEn.includes(kw.toLowerCase()));
  });
}
