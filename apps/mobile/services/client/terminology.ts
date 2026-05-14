import api from '../api';
import type { TerminologyPack } from '@deqah/shared/terminology';

/**
 * Fetches the merged terminology pack for a vertical from the public catalog.
 * Endpoint: GET /public/verticals/:slug/terminology — same shape as the
 * dashboard hook (`apps/dashboard/hooks/use-terminology.ts`).
 */
export const terminologyService = {
  async getPack(verticalSlug: string): Promise<TerminologyPack> {
    const response = await api.get<TerminologyPack>(
      `/public/verticals/${verticalSlug}/terminology`,
    );
    return response.data;
  },
};
