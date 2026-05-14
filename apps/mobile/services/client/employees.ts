import api from '../api';

export interface PublicEmployeeItem {
  id: string;
  slug: string | null;
  nameAr: string | null;
  nameEn: string | null;
  title: string | null;
  specialty: string | null;
  specialtyAr: string | null;
  publicBioAr: string | null;
  publicBioEn: string | null;
  publicImageUrl: string | null;
  gender: string | null;
  employmentType: string;
  ratingAverage?: number | null;
  ratingCount?: number;
  minServicePrice: number | null;
  isAvailableToday: boolean;
}

export const publicEmployeesService = {
  async list() {
    const response = await api.get<PublicEmployeeItem[]>('/public/employees');
    return response.data;
  },

  async getByKey(key: string) {
    const response = await api.get<PublicEmployeeItem>(`/public/employees/${key}`);
    return response.data;
  },

  async getSlots(params: {
    employeeId: string;
    branchId: string;
    date: string;
    durationMins?: number;
    serviceId?: string;
    durationOptionId?: string;
    bookingType?: string;
  }) {
    const response = await api.get<Array<{ startTime: string; endTime: string }>>(
      '/public/availability',
      { params },
    );
    return response.data;
  },
};
