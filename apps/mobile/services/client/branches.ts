import api from '../api';

export interface PublicBranchSummary {
  id: string;
  nameAr: string;
  nameEn: string;
  city: string | null;
  addressAr: string | null;
}

export interface PublicBranchDetail extends PublicBranchSummary {
  addressEn: string | null;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
  businessHours: Array<{
    dayOfWeek: number;
    isOpen: boolean;
    openTime: string | null;
    closeTime: string | null;
  }>;
}

export interface PublicBranchEmployee {
  id: string;
  nameAr: string;
  nameEn: string;
  slug: string | null;
  avatarUrl: string | null;
}

export const publicBranchesService = {
  async list() {
    const response = await api.get<PublicBranchSummary[]>('/public/branches');
    return response.data;
  },

  async getById(id: string) {
    const response = await api.get<PublicBranchDetail>(`/public/branches/${id}`);
    return response.data;
  },

  async listEmployees(id: string) {
    const response = await api.get<PublicBranchEmployee[]>(
      `/public/branches/${id}/employees`,
    );
    return response.data;
  },
};
