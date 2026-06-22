/**
 * Server-side / conceptual AuthUser shape.
 *
 * For the canonical user payload returned by /auth/login and /auth/me
 * (mirroring the live backend controller), use `UserPayload` from
 * `@sawaa/api-client` (it is the wire format the dashboard consumes).
 * This `AuthUser` is a higher-level abstract used by long-lived
 * shared types — keep them in sync when the backend shape changes.
 */
import type { UserGender } from '../enums/user';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  gender: UserGender | null;
  avatarUrl: string | null;
  isActive: boolean;
  emailVerified: boolean;
  createdAt: string;
  roles: string[];
  permissions: string[];
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface JwtPayload {
  sub: string;
  email: string;
  iat: number;
  exp: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  gender?: UserGender;
}

export interface OtpRequest {
  email: string;
}

export interface OtpVerifyRequest {
  email: string;
  code: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}
