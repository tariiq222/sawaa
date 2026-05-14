import api from './api';
import type { ApiResponse } from '@/types/api';

export interface OrganizationSettings {
  bankName: string | null;
  bankIban: string | null;
  accountHolder: string | null;
}

export const organizationService = {
  async getSettings(): Promise<ApiResponse<OrganizationSettings>> {
    const response = await api.get<ApiResponse<OrganizationSettings>>(
      '/organization/settings/public',
    );
    return response.data;
  },
};
