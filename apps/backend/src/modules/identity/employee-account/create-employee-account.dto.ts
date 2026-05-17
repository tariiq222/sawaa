import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { UserRole } from '@prisma/client';

export class CreateEmployeeAccountDto {
  @IsEnum(UserRole)
  @ApiProperty({
    enum: UserRole,
    enumName: 'UserRole',
    example: UserRole.RECEPTIONIST,
    description: 'System role to grant',
  })
  role!: UserRole;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @ApiPropertyOptional({
    description: 'Initial password (min 8 chars). Required only when no existing user account matches the employee email',
    format: 'password',
    example: 'P@ssw0rd123',
  })
  password?: string;
}
