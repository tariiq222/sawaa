import type { ClientProfile, ClientBookingItem } from '@deqah/shared';

export type { ClientProfile, ClientBookingItem };

export interface AuthState {
  client: ClientProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  name?: string;
  password: string;
  otpSessionToken: string;
}
