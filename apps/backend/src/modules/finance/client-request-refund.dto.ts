import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

/** Body of the client refund request (`POST /client/refunds/request`). */
export class ClientRequestRefundDto {
  @ApiProperty({ description: 'ID of the invoice to request a refund for', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  invoiceId!: string;

  @ApiPropertyOptional({ description: 'Optional reason for the refund request', example: 'Service was not provided' })
  @IsOptional()
  @IsString()
  reason?: string;
}
