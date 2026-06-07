// Canonical user payload returned by POST /auth/login and GET /auth/me.
// Fields here MUST match backend src/api/public/auth.controller.ts
// (loginEndpoint and meEndpoint shape after flattenPermissions).
export interface UserPayload {
  id: string
  email: string
  name: string
  // Derived from `name` by the backend (split on first whitespace run).
  // Optional only to tolerate legacy tokens that pre-date the SaaS-04
  // alignment; new responses always include them.
  firstName?: string
  lastName?: string
  phone: string | null
  gender: string | null
  avatarUrl: string | null
  isActive: boolean
  role: string
  customRoleId: string | null
  isSuperAdmin: boolean
  permissions: string[]
  // Deprecated single-tenant compatibility field. New backend responses stamp
  // the fixed deployment context when present; clients must not use it for
  // request routing or send it back as a legacy organization-selection header.
  organizationId: string | null
  // Deprecated multi-vertical compatibility field. Kept nullable until all
  // dashboard/mobile consumers stop depending on the historical auth shape.
  verticalSlug: string | null
  // ISO timestamp when the org's owner finished the onboarding wizard.
  // Null until completed; the dashboard layout uses it to redirect new
  // organizations to /onboarding.
  onboardingCompletedAt: string | null
  // Deprecated membership compatibility shape retained for staged frontend
  // cleanup. Do not use organizationId from this object for request context.
  activeMembership: {
    id: string
    organizationId: string
    role: string
    verticalSlug: string | null
    displayName: string | null
    jobTitle: string | null
    avatarUrl: string | null
  } | null
  // Last organization selected by the user. Kept in the contract for auth flows
  // that need to restore a valid organization after login.
  lastActiveOrganizationId?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface TokenPair {
  accessToken: string
  /** @deprecated CR-9: refresh token is now an httpOnly cookie (ck_refresh) and is no longer in the response body */
  refreshToken?: string
  expiresIn: number
}

export interface AuthResponse extends TokenPair {
  user: UserPayload
}

export interface ChangePasswordPayload {
  currentPassword: string
  newPassword: string
}
