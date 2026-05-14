import { WaitlistStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ListWaitlistDto {
  @ApiPropertyOptional({ description: 'Filter by employee', example: '00000000-0000-0000-0000-000000000000' })
  @IsOptional() @IsUUID() employeeId?: string;

  @ApiPropertyOptional({ description: 'Filter by waitlist entry status', enum: WaitlistStatus, enumName: 'WaitlistStatus', example: WaitlistStatus.WAITING })
  @IsOptional() @IsEnum(WaitlistStatus) status?: WaitlistStatus;
}
