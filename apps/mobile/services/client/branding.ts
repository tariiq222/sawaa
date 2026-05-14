import type { PublicBranding } from '@deqah/shared';
import api from '../api';

export const publicBrandingService = {
  async get(): Promise<PublicBranding> {
    const response = await api.get<PublicBranding>('/public/branding');
    return response.data;
  },
};
