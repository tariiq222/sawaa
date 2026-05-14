/**
 * Auth types — re-exports the canonical UserPayload from @deqah/api-client
 * so the mobile screens read the same shape the backend actually returns,
 * plus mobile-only enums and form payloads.
 */

import type { UserPayload, AuthResponse as CanonicalAuthResponse } from '@deqah/api-client';

// The canonical user payload returned by /auth/login + /auth/me, extended
// with mobile-only fields the backend does not (yet) return. Re-exported as
// `User` so existing mobile imports keep working without churn.
//
// firstName/lastName/organizationId now arrive at runtime — they were
// silently undefined before the SaaS-04 alignment.
//
// emailVerified + employeeId are NOT yet returned by the backend; they're
// kept here as optional so consumers compile, but values are `undefined` at
// runtime. Wiring them through is tracked in a follow-up issue (the
// EmailVerificationBanner stays hidden, the employee availability page
// needs its own membership/employee lookup).
export type User = UserPayload & {
  emailVerified?: boolean;
  emailVerifiedAt?: string | null;
  employeeId?: string | null;
};

/** Mobile-only nav role bucket (distinct from the backend Prisma UserRole). */
export type UserRole = 'client' | 'employee' | 'super_admin' | 'receptionist' | 'accountant';

/**
 * Maps the backend's `role` string (e.g. 'CLINIC_OWNER', 'RECEPTIONIST',
 * 'EMPLOYEE') onto the mobile's client/employee/staff bucket used for
 * bottom-tab routing. Pre-SaaS-04 this read user.roles[0].slug — a field
 * the backend never returned, so the function silently always returned
 * 'client'. Now reads `user.role`, the field the backend has always sent.
 */
export function getPrimaryRole(user: User): UserRole {
  const role = (user.role ?? '').toUpperCase();
  if (!role) return 'client';
  if (role === 'SUPER_ADMIN') return 'super_admin';
  if (role === 'RECEPTIONIST') return 'receptionist';
  if (role === 'ACCOUNTANT') return 'accountant';
  if (role === 'CLIENT') return 'client';
  // CLINIC_OWNER, EMPLOYEE, and any other staff bucket route through the
  // employee tabs.
  return 'employee';
}

export type ActiveMembership = { id: string; organizationId: string; role: string };

export interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: User | null;
  isLoading: boolean;
  organizationId: string | null;
  activeMembership: ActiveMembership | null;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginWithOtpRequest {
  email: string;
}

/** Backend expects field named "code", not "otp" */
export interface VerifyOtpRequest {
  email: string;
  code: string;
}

/**
 * Mobile wraps the canonical AuthResponse in the legacy `{success, data}`
 * envelope its callers (login screen, otp-verify, register) expect. The
 * shared @deqah/api-client returns the unwrapped shape, so services/auth.ts
 * re-wraps it before resolving to this interface.
 */
export interface AuthResponse {
  success: boolean;
  data: CanonicalAuthResponse | undefined;
}

/** Which mobile app flow the user belongs to */
export type MobileRole = 'client' | 'employee';

/** Backend staff role enum (mirrors Prisma UserRole) */
export type StaffRole =
  | 'SUPER_ADMIN'
  | 'CLINIC_OWNER'
  | 'RECEPTIONIST'
  | 'ACCOUNTANT'
  | 'EMPLOYEE';

/** Flat "subject:action" string produced by backend flattenPermissions() */
export type CaslPermission = string;

/** Unified user shape used by the mobile auth flow (client + staff). */
export interface AuthUser {
  kind: 'client' | 'staff';
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  emailVerified: boolean;
  staffRole: StaffRole | null;
  isSuperAdmin: boolean;
  permissions: CaslPermission[];
  organizationId: string | null;
}

/** Split a full name into first/last on the first whitespace. */
export function splitName(name: string): { firstName: string; lastName: string } {
  const trimmed = name.trim();
  if (!trimmed) return { firstName: '', lastName: '' };
  const idx = trimmed.search(/\s+/);
  if (idx === -1) return { firstName: trimmed, lastName: '' };
  return {
    firstName: trimmed.slice(0, idx),
    lastName: trimmed.slice(idx).trim(),
  };
}
