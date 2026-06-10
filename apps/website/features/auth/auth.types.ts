import type { ClientProfile, ClientBookingItem } from '@sawaa/shared';

export type { ClientProfile, ClientBookingItem };

export interface AuthState {
  client: ClientProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

/** Exactly one of `email` or `phone` is sent to POST /public/auth/login. */
export interface LoginCredentials {
  email?: string;
  phone?: string;
  password: string;
}

export interface RegisterCredentials {
  name?: string;
  password: string;
  otpSessionToken: string;
}
