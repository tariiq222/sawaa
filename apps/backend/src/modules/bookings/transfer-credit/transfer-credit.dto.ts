import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TransferCreditDto {
  @ApiProperty({
    description: 'Target employee (practitioner) to move the credit to',
    example: '00000000-0000-4000-a000-000000000099',
  })
  @IsUUID()
  toEmployeeId!: string;

  @ApiPropertyOptional({ description: 'Reason recorded in the package-credit assignment history', example: 'Practitioner left the clinic' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  reason?: string;

  @ApiPropertyOptional({ description: 'Optional active duration option on the target practitioner with the same frozen duration and delivery type', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  targetDurationOptionId?: string;
}
