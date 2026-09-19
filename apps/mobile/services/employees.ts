import api from './api';
import type { ApiResponse, PaginatedResponse } from '@/types/api';
import type { Employee, Rating } from '@/types/models';
import { resolveDeliveryType } from '@/types/booking-enums';
import type { BookingType, DeliveryType } from '@/types/booking-enums';

export type EmployeeAvailability = {
  id?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive?: boolean;
};

export type AvailabilityException = {
  id?: string;
  startDate: string;
  endDate: string;
  reason?: string | null;
};

export interface AvailabilityDayGroup {
  dayOfWeek: number;
  windows: EmployeeAvailability[];
}

export interface AvailabilityUpdatePayload {
  windows: Array<Pick<EmployeeAvailability, 'dayOfWeek' | 'startTime' | 'endTime' | 'isActive'>>;
  exceptions: Array<Pick<AvailabilityException, 'startDate' | 'endDate' | 'reason'>>;
}

export interface EmployeeAvailabilitySchedule {
  employeeId: string;
  windows: EmployeeAvailability[];
  exceptions: AvailabilityException[];
}

export function toggleAvailabilityDay(
  schedule: AvailabilityDayGroup[],
  dayIndex: number,
): AvailabilityDayGroup[] {
  return schedule.map((day) => {
    if (day.dayOfWeek !== dayIndex) return day;
    if (day.windows.length === 0) {
      return {
        ...day,
        windows: [{ dayOfWeek: dayIndex, startTime: '08:00', endTime: '17:00', isActive: true }],
      };
    }
    const isWorking = day.windows.some((window) => window.isActive !== false);
    return {
      ...day,
      windows: day.windows.map((window) => ({ ...window, isActive: !isWorking })),
    };
  });
}

export function projectAvailabilityForUpdate(input: {
  windows: EmployeeAvailability[];
  exceptions: AvailabilityException[];
}): AvailabilityUpdatePayload {
  return {
    windows: input.windows.map(({ dayOfWeek, startTime, endTime, isActive }) => ({
      dayOfWeek,
      startTime,
      endTime,
      isActive,
    })),
    exceptions: input.exceptions.map(({ startDate, endDate, reason }) => ({
      startDate,
      endDate,
      reason: reason ?? null,
    })),
  };
}

interface GetEmployeesParams {
  search?: string;
  sort?: 'rating' | 'name' | 'price';
  page?: number;
  limit?: number;
}

export const employeesService = {
  async getAll(params?: GetEmployeesParams) {
    const response = await api.get<PaginatedResponse<Employee>>(
      '/employees',
      { params },
    );
    return response.data;
  },

  async getById(id: string) {
    const response = await api.get<ApiResponse<Employee>>(
      `/employees/${id}`,
    );
    return response.data;
  },

  async getAvailability(
    id: string,
    date: string,
    options?: {
      duration?: number;
      serviceId?: string;
      deliveryType?: DeliveryType;
      /** Appointment/category type only. Never use for delivery channel. */
      bookingType?: BookingType;
    },
  ) {
    const selectedDeliveryType = resolveDeliveryType(options?.deliveryType);
    const bookingCategoryParam = options?.bookingType === 'group'
      ? 'GROUP'
      : options?.bookingType === 'walk_in'
        ? 'WALK_IN'
        : 'INDIVIDUAL';

    const response = await api.get<ApiResponse<{ slots: Array<{ startTime: string; endTime: string; available: boolean }> }>>(
      `/employees/${id}/slots`,
      {
        params: {
          date,
          ...(options?.duration && { duration: options.duration }),
          ...(options?.serviceId && { serviceId: options.serviceId }),
          deliveryType: selectedDeliveryType,
          bookingType: bookingCategoryParam,
        },
      },
    );
    return response.data;
  },

  async getRatings(id: string, page = 1, limit = 10) {
    const response = await api.get<PaginatedResponse<Rating>>(
      `/employees/${id}/ratings`,
      { params: { page, limit } },
    );
    return response.data;
  },

  async getFeatured() {
    const response = await api.get<ApiResponse<Employee[]>>(
      '/employees',
      { params: { sort: 'rating', limit: 5 } },
    );
    return response.data;
  },

  async updateAvailabilitySchedule(payload: { windows: EmployeeAvailability[]; exceptions: AvailabilityException[] }) {
    const updatePayload = projectAvailabilityForUpdate(payload);
    const response = await api.patch<{ windows: EmployeeAvailability[]; exceptions: AvailabilityException[] }>(
      '/mobile/employee/schedule/availability',
      updatePayload,
    );
    return response.data;
  },

  async getAvailabilitySchedule() {
    const response = await api.get<EmployeeAvailabilitySchedule>('/mobile/employee/schedule/availability');
    return response.data;
  },
};
