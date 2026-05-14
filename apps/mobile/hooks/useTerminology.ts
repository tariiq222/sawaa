/**
 * useTerminology — Mobile mirror of the dashboard hook
 * (`apps/dashboard/hooks/use-terminology.ts`).
 *
 * Fetches the merged vertical terminology pack from the public catalog and
 * exposes a locale-aware `t(key)` resolver. The caller supplies the
 * `verticalSlug`; the dashboard hook makes the same trade-off — neither the
 * auth session nor OrganizationSettings carry the slug today (Plan 07).
 *
 * For the tenant-locked mobile binary the slug should normally come from
 * `EXPO_PUBLIC_VERTICAL_SLUG` (see `constants/config.ts` -> `VERTICAL_SLUG`).
 *
 * Example:
 *   const { t } = useTerminology(VERTICAL_SLUG)
 *   t('employee.plural') // → "المستشارون" / "Consultants" for family-consulting
 */

import { useQuery } from '@tanstack/react-query';

import { terminologyService } from '@/services/client/terminology';
import { useDir } from '@/hooks/useDir';
import type {
  TerminologyKey,
  TerminologyPack,
} from '@deqah/shared/terminology';

export const terminologyQueryKey = (slug: string | undefined) =>
  ['terminology', slug] as const;

export interface UseTerminologyResult {
  /**
   * Resolve a terminology key to a localised string. If the pack hasn't
   * loaded yet (or the key is missing), returns the second argument when
   * provided, else falls back to the key itself.
   */
  t: (key: TerminologyKey, fallback?: string) => string;
  isLoading: boolean;
  pack: TerminologyPack | undefined;
}

export function useTerminology(
  verticalSlug: string | undefined,
): UseTerminologyResult {
  const { locale } = useDir();

  const query = useQuery<TerminologyPack>({
    queryKey: terminologyQueryKey(verticalSlug),
    queryFn: () => {
      if (!verticalSlug) {
        // `enabled` gates this, but TS narrows here for safety.
        throw new Error('verticalSlug is required');
      }
      return terminologyService.getPack(verticalSlug);
    },
    enabled: !!verticalSlug,
    staleTime: 30 * 60 * 1000, // 30 min — terminology rarely changes
  });

  const t = (key: TerminologyKey, fallback?: string): string => {
    const token = query.data?.[key];
    if (!token) return fallback ?? key;
    return token[locale] ?? token.ar ?? fallback ?? key;
  };

  return {
    t,
    isLoading: query.isLoading,
    pack: query.data,
  };
}
