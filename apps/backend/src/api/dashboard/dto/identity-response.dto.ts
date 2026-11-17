import { ApiProperty } from '@nestjs/swagger';
import { PermissionAction, PermissionSubject } from '@sawaa/shared/constants/permissions-catalog';
import { UserGender, UserRole, type User } from '@prisma/client';

/**
 * Response shapes of `dashboard/identity.controller.ts` that are not already
 * documented by `modules/identity/users/dashboard-user-response.dto.ts`
 * (`GET /users` and `GET /users/:id` keep those schemas).
 *
 * Documentation only — the classes are never instantiated.
 *
 * Security: the write handlers `omit: { passwordHash: true }`, so
 * `passwordHash` is never on the wire. Nothing in this file documents it.
 */

const UUID_EXAMPLE = '00000000-0000-4000-a000-0000000000f1';
const ISO_EXAMPLE = '2026-10-10T09:00:00.000Z';

/**
 * One persisted `User` row as the write routes return it: every column except
 * `passwordHash`, with no `customRole` relation. Returned verbatim by
 * `POST /users`, `PATCH /users/:id` and `PATCH /users/:id/role`.
 */
export class IdentityUserRecordDto {
  @ApiProperty({ format: 'uuid', description: 'User UUID', example: UUID_EXAMPLE })
  id!: string;

  @ApiProperty({ description: 'Numeric user reference used in USR-prefixed links', example: 42 })
  ref!: number;

  @ApiProperty({ format: 'email', description: 'User email address', example: 'coordinator@example.test' })
  email!: string;

  @ApiProperty({ description: 'Whether this user is a super admin', example: false })
  isSuperAdmin!: boolean;

  @ApiProperty({ type: String, nullable: true, description: 'First name, or null', example: 'Sara' })
  firstName!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Last name, or null', example: 'Al-Harbi' })
  lastName!: string | null;

  @ApiProperty({ description: 'Display name', example: 'Sara Al-Harbi' })
  name!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Phone number, or null', example: '+966501234567' })
  phone!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Phone-verification instant, or null', example: null })
  phoneVerifiedAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Email-verification instant, or null', example: null })
  emailVerifiedAt!: Date | null;

  @ApiProperty({ enum: UserGender, enumName: 'UserGender', nullable: true, description: 'Gender, or null', example: 'FEMALE' })
  gender!: UserGender | null;

  @ApiProperty({ type: String, nullable: true, description: 'Avatar URL, or null', example: null })
  avatarUrl!: string | null;

  @ApiProperty({ description: 'Whether the account is active', example: true })
  isActive!: boolean;

  @ApiProperty({ enum: UserRole, enumName: 'UserRole', description: 'Built-in role', example: 'EMPLOYEE' })
  role!: UserRole;

  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: 'Assigned custom role UUID, or null', example: null })
  customRoleId!: string | null;

  @ApiProperty({ type: String, format: 'date-time', description: 'Creation instant', example: ISO_EXAMPLE })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time', description: 'Last update instant', example: ISO_EXAMPLE })
  updatedAt!: Date;

  @ApiProperty({ description: 'Failed login attempts since the last reset', example: 0 })
  failedLoginAttempts!: number;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Login lockout expiry, or null', example: null })
  lockedUntil!: Date | null;

  @ApiProperty({ description: 'Token version used to invalidate outstanding JWTs', example: 0 })
  tokenVersion!: number;
}

/** One permission row attached to a system or custom role. */
export class IdentityRolePermissionDto {
  @ApiProperty({ format: 'uuid', description: 'Permission row UUID', example: '00000000-0000-4000-a000-0000000000f2' })
  id!: string;

  @ApiProperty({ format: 'uuid', description: 'Owning custom-role UUID', example: '00000000-0000-4000-a000-0000000000f3' })
  customRoleId!: string;

  @ApiProperty({ description: 'CASL action', example: 'read' })
  action!: string;

  @ApiProperty({ description: 'CASL subject', example: 'Booking' })
  subject!: string;

  @ApiProperty({ type: String, format: 'date-time', description: 'Creation instant', example: ISO_EXAMPLE })
  createdAt!: Date;
}

/**
 * One role row (`ListRolesHandler` includes permissions; `CreateRoleHandler`
 * includes an empty array). `systemKey` is the built-in role vocabulary for
 * system roles and null for custom ones.
 */
export class IdentityRoleDto {
  @ApiProperty({ format: 'uuid', description: 'Role UUID', example: '00000000-0000-4000-a000-0000000000f3' })
  id!: string;

  @ApiProperty({ description: 'Role display name', example: 'Program coordinator' })
  name!: string;

  @ApiProperty({ description: 'Whether this is a built-in system role', example: false })
  isSystem!: boolean;

  @ApiProperty({ enum: UserRole, enumName: 'UserRole', nullable: true, description: 'Built-in role key for system roles, or null', example: null })
  systemKey!: UserRole | null;

  @ApiProperty({ description: 'Whether an admin has customized a system role\'s permissions', example: false })
  permissionsCustomized!: boolean;

  @ApiProperty({ type: [IdentityRolePermissionDto], description: 'Permissions granted to the role' })
  permissions!: IdentityRolePermissionDto[];

  @ApiProperty({ type: String, format: 'date-time', description: 'Creation instant', example: ISO_EXAMPLE })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time', description: 'Last update instant', example: ISO_EXAMPLE })
  updatedAt!: Date;
}

/** `GET /dashboard/identity/permissions` — one entry of the static CASL catalog. */
export class IdentityPermissionCatalogEntryDto {
  @ApiProperty({ description: 'Synthetic catalog id (`<Subject>:<action>`)', example: 'Booking:read' })
  id!: string;

  @ApiProperty({ description: 'CASL subject from the shared catalog', example: 'Booking' })
  module!: PermissionSubject;

  @ApiProperty({ description: 'CASL action from the shared catalog', example: 'read' })
  action!: PermissionAction;
}

// Compile-time guards: the write-row DTO must list exactly the Prisma columns
// minus the omitted hash; the role row must list exactly the columns the
// handlers return.
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type OmittedUser = Omit<User, 'passwordHash'>;
export const identityUserRecordDtoMatchesPrismaRow: Equal<keyof IdentityUserRecordDto, keyof OmittedUser> = true;
