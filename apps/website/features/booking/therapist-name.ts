/**
 * Localized therapist display name. Prefers the active locale's name
 * (nameAr/nameEn from the Employee record), falls back to the other language,
 * then to the synthetic first/last name the public endpoint derives from the
 * Arabic name.
 */
export function therapistDisplayName(
  emp: {
    nameAr?: string | null;
    nameEn?: string | null;
    user?: { firstName?: string | null; lastName?: string | null } | null;
  },
  isAr: boolean,
): string {
  const ar = emp.nameAr?.trim() || null;
  const en = emp.nameEn?.trim() || null;
  const fromUser =
    `${emp.user?.firstName ?? ''} ${emp.user?.lastName ?? ''}`.trim() || null;
  const primary = isAr ? ar ?? en : en ?? ar;
  return primary ?? fromUser ?? '';
}

/** Two-letter initials from a display name's first two tokens. */
export function initialsFromName(name: string): string {
  const tokens = name.trim().split(/\s+/).filter(Boolean);
  const a = tokens[0]?.charAt(0) ?? '';
  const b = tokens[1]?.charAt(0) ?? '';
  return (a + b).toUpperCase() || '—';
}
