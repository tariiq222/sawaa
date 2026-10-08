import api from '../api';
import { resolveDeliveryType } from '@/types/booking-enums';
import type { BookingType, DeliveryType } from '@/types/booking-enums';

export interface PublicEmployeeItem {
  id: string;
  slug: string | null;
  nameAr: string | null;
  nameEn: string | null;
  title: string | null;
  specialty: string | null;
  specialtyAr: string | null;
  languages?: string[];
  experience?: number;
  publicBioAr: string | null;
  publicBioEn: string | null;
  publicImageUrl: string | null;
  gender: string | null;
  employmentType: string;
  serviceIds: string[];
  isBookable: boolean;
  ratingAverage?: number | null;
  ratingCount?: number;
  minServicePrice: number | null;
  isAvailableToday: boolean;
}

export interface AvailableDay {
  date: string;
  hasSlots: boolean;
}

interface AvailabilityContext {
  employeeId: string;
  branchId: string;
  serviceId?: string;
  durationMins?: number;
  durationOptionId?: string;
  deliveryType?: DeliveryType;
  bookingType?: BookingType;
}

function availabilityParams({ deliveryType, bookingType, durationOptionId, ...rest }: AvailabilityContext) {
  const selectedDeliveryType = resolveDeliveryType(deliveryType);
  return {
    ...rest,
    ...(durationOptionId?.trim() ? { durationOptionId } : {}),
    deliveryType: selectedDeliveryType === 'online' ? 'ONLINE' : 'IN_PERSON',
    bookingType: bookingType === 'group' ? 'GROUP' : bookingType === 'walk_in' ? 'WALK_IN' : 'INDIVIDUAL',
  };
}

export const publicEmployeesService = {
  async list() {
    const response = await api.get<PublicEmployeeItem[]>('/public/employees', { params: { includeDirectClinics: true } });
    return response.data;
  },

  async getByKey(key: string) {
    const response = await api.get<PublicEmployeeItem>(`/public/employees/${key}`, { params: { includeDirectClinics: true } });
    return response.data;
  },

  async getSlots(params: {
    date: string;
  } & AvailabilityContext) {
    const response = await api.get<Array<{ startTime: string; endTime: string }>>(
      '/public/availability',
      { params: availabilityParams(params) },
    );
    return response.data;
  },

  async getAvailableDays(params: {
    startDate: string;
    days: number;
  } & AvailabilityContext) {
    const { employeeId, ...rest } = availabilityParams(params);
    const response = await api.get<AvailableDay[]>(
      `/public/employees/${employeeId}/availability/days`,
      { params: rest },
    );
    return response.data;
  },
};
