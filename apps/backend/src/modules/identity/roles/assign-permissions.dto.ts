import { ArrayMaxSize, IsArray, IsIn, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { PERMISSION_ACTIONS, PERMISSION_SUBJECTS } from '@sawaa/shared/constants';

// SECURITY (P0-3): action and subject MUST be constrained to the canonical
// catalog. Previously they were free-form @IsString(), which allowed any user
// with manage:Role to create a customRole granting `{ action: 'manage', subject: 'all' }`
// and self-promote to full SUPER_ADMIN.
class PermissionEntryDto {
  @ApiProperty({ description: 'CASL action', enum: PERMISSION_ACTIONS, example: 'read' })
  @IsIn(PERMISSION_ACTIONS as unknown as string[]) action!: string;

  @ApiProperty({ description: 'CASL subject (resource name)', enum: PERMISSION_SUBJECTS, example: 'Booking' })
  @IsIn(PERMISSION_SUBJECTS as unknown as string[]) subject!: string;
}

export class AssignPermissionsDto {
  @ApiProperty({ description: 'Full list of permissions to assign to the role', type: [PermissionEntryDto] })
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => PermissionEntryDto)
  permissions!: PermissionEntryDto[];
}
