import { IsDefined, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min, ValidateIf } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { RefundType } from '@prisma/client';

export class ApproveCancelBookingDto {
  @ApiPropertyOptional({ description: 'Optional notes from the approver', example: 'Approved per client request' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  approverNotes?: string;

  @ApiPropertyOptional({
    description: 'Refund decision recorded with the approval (informational — refund execution is a separate manual finance flow)',
    enum: RefundType,
    example: RefundType.PARTIAL,
  })
  @IsOptional()
  @IsEnum(RefundType)
  refundType?: RefundType;

  @ApiPropertyOptional({
    description: 'Refund amount in halalas. Required when refundType is PARTIAL; must be omitted otherwise.',
    example: 5000,
  })
  @ValidateIf((o: ApproveCancelBookingDto) => o.refundType === RefundType.PARTIAL || o.refundAmount !== undefined)
  @IsDefined({ message: 'refundAmount is required when refundType is PARTIAL' })
  @IsInt()
  @Min(1)
  refundAmount?: number;
}
