import { IsArray, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class PermissionEntryDto {
  @ApiProperty({ description: 'CASL action (e.g. manage, read, create)', example: 'read' })
  @IsString() action!: string;

  @ApiProperty({ description: 'CASL subject (resource name or "all")', example: 'Booking' })
  @IsString() subject!: string;
}

export class AssignPermissionsDto {
  @ApiProperty({ description: 'Full list of permissions to assign to the role', type: [PermissionEntryDto] })
  @IsArray() @ValidateNested({ each: true }) @Type(() => PermissionEntryDto) permissions!: PermissionEntryDto[];
}
