import api from '../api';

/**
 * Mirrors `MobileUpdateProfileBody` in
 * apps/backend/src/api/mobile/client/profile.controller.ts.
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
  /** GET /mobile/client/profile */
  async getProfile(): Promise<ClientProfile> {
    const res = await api.get<ClientProfile>('/mobile/client/profile');
    return res.data;
  },

  /** PATCH /mobile/client/profile */
  async updateProfile(body: ClientProfileUpdate): Promise<ClientProfile> {
    const res = await api.patch<ClientProfile>('/mobile/client/profile', body);
    return res.data;
  },
};
