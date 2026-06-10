/**
 * Auth types — local declarations of the auth contract the backend returns.
 *
 * Mobile is intentionally OUTSIDE the pnpm workspace, so these types are
 * declared here rather than imported from @sawaa/api-client. They MUST match
 * the backend's AuthResponseBuilder
 * (apps/backend/src/modules/identity/shared/auth-response.builder.ts) and
 * GET /auth/me (get-current-user.handler.ts) shapes. Update by hand when the
 * backend contract changes.
 */

/**
 * Canonical user payload returned by POST /auth/login and GET /auth/me
 * after the single-tenant cleanup (no organizationId, verticalSlug, or
 * activeMembership).
 */
export interface UserPayload {
  id: string;
  email: string;
  name: string;
  /** Derived from `name` by the backend (split on first whitespace run). */
  firstName: string;
  lastName: string;
  phone: string | null;
  gender: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  role: string;
  isSuperAdmin: boolean;
  /** Flat "subject:action" strings produced by backend flattenPermissions(). */
  permissions: string[];
}

/**
 * Bare auth payload the backend returns from login/OTP-verify:
 * `{ accessToken, refreshToken, expiresIn, user }`.
 */
export interface CanonicalAuthResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  user: UserPayload;
}

// The canonical user payload extended with mobile-only fields the backend
// does not (yet) return. Exported as `User` so existing mobile imports keep
// working without churn.
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

export interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: User | null;
  isLoading: boolean;
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
 * Mobile wraps the canonical auth payload in the legacy `{success, data}`
 * envelope its callers (login screen, otp-verify, register) expect. The
 * backend returns the unwrapped shape, so services/auth.ts re-wraps it
 * before resolving to this interface.
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
