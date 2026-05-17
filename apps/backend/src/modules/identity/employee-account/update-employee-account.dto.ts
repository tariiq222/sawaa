import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { UserRole } from '@prisma/client';

export class UpdateEmployeeAccountDto {
  @IsOptional()
  @IsEnum(UserRole)
  @ApiPropertyOptional({
    enum: UserRole,
    enumName: 'UserRole',
    example: UserRole.ADMIN,
  })
  role?: UserRole;

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional({
    example: true,
    description: 'Enable or disable the login account',
  })
  isActive?: boolean;
}
