import type { components, paths } from './generated/openapi'

type Schemas = components['schemas']

/** 200 body of `POST /api/v1/auth/login` (also the OTP-verify success shape). */
type LoginBody = paths['/api/v1/auth/login']['post']['responses'][200]['content']['application/json']

/** 200 body of `POST /api/v1/auth/refresh`. */
type RefreshBody = paths['/api/v1/auth/refresh']['post']['responses'][200]['content']['application/json']

/** Documented user payload inside the login response. */
type LoginUser = NonNullable<LoginBody['user']>

/**
 * Canonical user payload returned by POST /auth/login and GET /auth/me.
 *
 * Field types come from the login response's documented `user` object; the
 * required/optional split is pinned locally because the snapshot marks every
 * property optional (the controller declares the schema without `required`).
 */
export type UserPayload = Required<
  Pick<
    LoginUser,
    | 'id'
    | 'email'
    | 'name'
    | 'phone'
    | 'gender'
    | 'avatarUrl'
    | 'isActive'
    | 'role'
    | 'isSuperAdmin'
    | 'permissions'
  >
> & {
  // Derived from `name` by the backend (split on first whitespace run); the
  // snapshot documents it but does not require it — legacy tokens omit it.
  firstName?: LoginUser['firstName']
  lastName?: LoginUser['lastName']
  // Not in the snapshot's auth-user object, but GET /auth/me spreads the Prisma
  // user row (get-current-user.handler.ts), which always carries these.
  customRoleId: string | null
  onboardingCompletedAt: string | null
  createdAt?: Schemas['DashboardUserResponseDto']['createdAt']
  updatedAt?: Schemas['DashboardUserResponseDto']['updatedAt']
}

export interface TokenPair {
  accessToken: NonNullable<RefreshBody['accessToken']>
  /** @deprecated CR-9: refresh token is now an httpOnly cookie (ck_refresh) and is no longer in the response body */
  refreshToken?: string
  expiresIn: NonNullable<RefreshBody['expiresIn']>
}

export interface AuthResponse extends TokenPair {
  /** Present only as false on authenticated login responses; true denotes the separate 2FA challenge shape. */
  requiresOtp?: false
  user: UserPayload
}

/** Request body of `PATCH /api/v1/auth/password/change` (`ChangePasswordDto`). */
export type ChangePasswordPayload = Schemas['ChangePasswordDto']
