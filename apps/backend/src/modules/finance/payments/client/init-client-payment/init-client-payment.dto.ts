import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';

export const CLIENT_PAYMENT_METHODS = ['ONLINE_CARD', 'APPLE_PAY'] as const;

export type ClientPaymentMethod = typeof CLIENT_PAYMENT_METHODS[number];

export class InitClientPaymentDto {
  @ApiProperty({ description: 'Invoice UUID', example: '00000000-0000-0000-0000-000000000000' })
  @IsUUID()
  invoiceId!: string;

  @ApiPropertyOptional({
    description: 'Payment method requested by the mobile client',
    enum: CLIENT_PAYMENT_METHODS,
    example: 'ONLINE_CARD',
  })
  @IsOptional()
  @IsIn(CLIENT_PAYMENT_METHODS)
  method?: ClientPaymentMethod;
}
