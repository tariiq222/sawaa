import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { IntakeFormType } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ResolveApplicableIntakeFormsDto {
  @ApiPropertyOptional({ description: 'Service ID to match SERVICE-scoped forms', format: 'uuid', example: '00000000-0000-0000-0000-000000000000' })
  @IsOptional() @IsUUID() serviceId?: string;

  @ApiPropertyOptional({ description: 'Employee ID to match EMPLOYEE-scoped forms', format: 'uuid', example: '00000000-0000-0000-0000-000000000000' })
  @IsOptional() @IsUUID() employeeId?: string;

  @ApiPropertyOptional({ description: 'Branch ID to match BRANCH-scoped forms', format: 'uuid', example: '00000000-0000-0000-0000-000000000000' })
  @IsOptional() @IsUUID() branchId?: string;

  @ApiPropertyOptional({ description: 'Restrict to a single form type', enum: IntakeFormType, example: IntakeFormType.PRE_BOOKING })
  @IsOptional() @IsEnum(IntakeFormType) type?: IntakeFormType;
}
