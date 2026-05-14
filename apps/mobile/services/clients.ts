import api from './api';
import type { ApiResponse, PaginatedResponse } from '@/types/api';
import type { Booking } from '@/types/models';

export interface ClientRecord {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string;
  avatarUrl: string | null;
}

export const clientsService = {
  async getById(id: string) {
    const response = await api.get<ApiResponse<ClientRecord>>(`/clients/${id}`);
    return response.data;
  },

  async getEmployeeBookings(clientId: string) {
    const response = await api.get<PaginatedResponse<Booking>>('/bookings', {
      params: { clientId, limit: 50 },
    });
    return response.data;
  },

  async getAll(params?: { search?: string; page?: number; limit?: number }) {
    const response = await api.get<PaginatedResponse<ClientRecord>>('/clients', { params });
    return response.data;
  },
};
