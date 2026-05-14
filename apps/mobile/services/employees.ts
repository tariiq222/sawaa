import api from './api';
import type { ApiResponse, PaginatedResponse } from '@/types/api';
import type { Employee, Rating } from '@/types/models';

export type EmployeeAvailability = {
  dayOfWeek: number;
  isWorking: boolean;
  startTime: string;
  endTime: string;
};

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

  async getAvailability(id: string, date: string, options?: { duration?: number; serviceId?: string; bookingType?: string }) {
    const response = await api.get<ApiResponse<{ slots: Array<{ startTime: string; endTime: string; available: boolean }> }>>(
      `/employees/${id}/slots`,
      {
        params: {
          date,
          ...(options?.duration && { duration: options.duration }),
          ...(options?.serviceId && { serviceId: options.serviceId }),
          ...(options?.bookingType && { bookingType: options.bookingType }),
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

  async getAvailabilitySchedule(id: string) {
    const response = await api.get<ApiResponse<EmployeeAvailability[]>>(
      `/employees/${id}/availability`,
    );
    return response.data;
  },

  async updateAvailabilitySchedule(id: string, schedule: EmployeeAvailability[]) {
    const response = await api.put<ApiResponse<EmployeeAvailability[]>>(
      `/employees/${id}/availability`,
      { schedule },
    );
    return response.data;
  },
};
