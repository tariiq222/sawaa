import api from '../api';

/**
 * Mirrors `MobileUpdateProfileBody` in
 * apps/backend/src/api/client/profile.controller.ts.
 * Backend returns a serialized Client (not a User) — callers should
 * map fields they need into the auth User in Redux.
 */
export interface ClientProfileUpdate {
  name?: string;
  phone?: string | null;
  email?: string | null;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  dateOfBirth?: string | null;
  avatarUrl?: string | null;
  notes?: string | null;
  preferredLocale?: string | null;
  pushEnabled?: boolean;
}

export interface ClientProfile {
  id: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  preferredLocale: string | null;
  pushEnabled: boolean;
}

export const clientProfileService = {
  /** GET /client/profile */
  async getProfile(): Promise<ClientProfile> {
    const res = await api.get<ClientProfile>('/client/profile');
    return res.data;
  },

  /** PATCH /client/profile */
  async updateProfile(body: ClientProfileUpdate): Promise<ClientProfile> {
    const res = await api.patch<ClientProfile>('/client/profile', body);
    return res.data;
  },
};
