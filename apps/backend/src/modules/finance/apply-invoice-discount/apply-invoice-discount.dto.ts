import { IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApplyInvoiceDiscountDto {
  @ApiProperty({
    description: 'Discount amount applied to the invoice subtotal, in integer halalas (1 SAR = 100). Send 0 to clear the discount.',
    example: 5000,
  })
  @IsInt() @Min(0)
  discountAmt!: number;

  @ApiPropertyOptional({
    description: 'Reason for the discount (must reference an active DiscountReason). Required when discountAmt > 0.',
    example: '00000000-0000-0000-0000-000000000000',
  })
  @IsOptional() @IsUUID()
  discountReasonId?: string;

  @ApiPropertyOptional({ description: 'Optional free-text note stored on the invoice', example: 'موافقة المدير' })
  @IsOptional() @IsString()
  note?: string;
}
