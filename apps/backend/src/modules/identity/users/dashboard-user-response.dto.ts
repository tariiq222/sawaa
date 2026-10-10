import { ApiProperty } from '@nestjs/swagger';
import { UserGender, UserRole } from '@prisma/client';

export class DashboardUserCustomRoleDto {
  @ApiProperty({ type: String, format: 'uuid', description: "Assigned custom role identifier", example: "55555555-5555-4555-8555-555555555555" })
  id!: string;

  @ApiProperty({ type: String, description: 'Display name of the assigned custom role', example: "Program coordinator" })
  name!: string;
}

export class DashboardUserResponseDto {
  @ApiProperty({ type: String, format: 'uuid', description: "Unique user identifier", example: "11111111-1111-4111-8111-111111111111" }) id!: string;
  @ApiProperty({ type: Number, description: "Numeric user reference used in USR-prefixed dashboard links", example: 42 }) ref!: number;
  @ApiProperty({ type: String, format: 'email', description: "User email address", example: "coordinator@example.test" }) email!: string;
  @ApiProperty({ type: String, description: "User display name", example: "Program Coordinator" }) name!: string;
  @ApiProperty({ type: String, nullable: true, description: "User phone number, or null when no number is stored", example: null }) phone!: string | null;
  @ApiProperty({ enum: UserGender, enumName: 'UserGender', nullable: true, description: "User gender, or null when unspecified", example: "FEMALE" }) gender!: UserGender | null;
  @ApiProperty({ type: String, nullable: true, description: "User avatar URL, or null when no avatar is stored", example: null }) avatarUrl!: string | null;
  @ApiProperty({ type: Boolean, description: "Whether the user account is active", example: true }) isActive!: boolean;
  @ApiProperty({ enum: UserRole, enumName: 'UserRole', description: "Assigned built-in user role", example: "EMPLOYEE" }) role!: UserRole;
  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: "Assigned custom role identifier, or null when no custom role is assigned", example: "55555555-5555-4555-8555-555555555555" }) customRoleId!: string | null;
  @ApiProperty({ type: () => DashboardUserCustomRoleDto, nullable: true, description: 'Assigned custom role identity only; permissions are not included', example: {"id": "55555555-5555-4555-8555-555555555555", "name": "Program coordinator"} })
  customRole!: DashboardUserCustomRoleDto | null;
  @ApiProperty({ type: String, format: 'date-time', description: "User creation time as an ISO 8601 UTC timestamp", example: "2026-10-10T09:00:00.000Z" }) createdAt!: string;
  @ApiProperty({ type: String, format: 'date-time', description: "Most recent user update time as an ISO 8601 UTC timestamp", example: "2026-10-10T09:00:00.000Z" }) updatedAt!: string;
}

export class DashboardUsersMetaDto {
  @ApiProperty({ type: Number, description: "Total number of matching users", example: 1 }) total!: number;
  @ApiProperty({ type: Number, description: "Current page number, starting at one", example: 1 }) page!: number;
  @ApiProperty({ type: Number, description: "Maximum number of items returned per page", example: 20 }) limit!: number;
  @ApiProperty({ type: Number, description: "Total number of pages for the matching result set", example: 1 }) totalPages!: number;
  @ApiProperty({ type: Boolean, description: "Whether another page follows the current page", example: false }) hasNextPage!: boolean;
  @ApiProperty({ type: Boolean, description: "Whether a page precedes the current page", example: false }) hasPreviousPage!: boolean;
}

export class DashboardUsersResponseDto {
  @ApiProperty({ type: () => DashboardUserResponseDto, isArray: true, description: "Users on the requested page", example: [{"id": "11111111-1111-4111-8111-111111111111", "ref": 42, "email": "coordinator@example.test", "name": "Program Coordinator", "phone": null, "gender": "FEMALE", "avatarUrl": null, "isActive": true, "role": "EMPLOYEE", "customRoleId": "55555555-5555-4555-8555-555555555555", "customRole": {"id": "55555555-5555-4555-8555-555555555555", "name": "Program coordinator"}, "createdAt": "2026-10-10T09:00:00.000Z", "updatedAt": "2026-10-10T09:00:00.000Z"}] }) items!: DashboardUserResponseDto[];
  @ApiProperty({ type: () => DashboardUsersMetaDto, description: "Pagination metadata for all matching users", example: {"total": 1, "page": 1, "limit": 20, "totalPages": 1, "hasNextPage": false, "hasPreviousPage": false} }) meta!: DashboardUsersMetaDto;
}
