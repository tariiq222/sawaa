import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsString, IsOptional } from 'class-validator';
import { ClientSessionGuard } from '../../common/guards/client-session.guard';
import { ClientSession } from '../../common/auth/client-session.decorator';
import { ApiPublicResponses } from '../../common/swagger';
import { RequestRefundHandler } from '../../modules/finance/refund-payment/request-refund.handler';

class RequestRefundDto {
  @ApiProperty({ description: 'ID of the invoice to request a refund for', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  invoiceId!: string;

  @ApiPropertyOptional({ description: 'Optional reason for the refund request', example: 'Service was not provided' })
  @IsOptional()
  @IsString()
  reason?: string;
}

@ApiTags('Public / Refunds')
@ApiBearerAuth()
@ApiPublicResponses()
@Controller('public/refunds')
export class PublicRefundsController {
  constructor(private readonly requestRefundHandler: RequestRefundHandler) {}

  @UseGuards(ClientSessionGuard)
  @Post('request')
  @ApiOperation({ summary: 'Request a refund for an invoice (requires client auth)' })
  async requestRefund(
    @ClientSession() client: { id: string },
    @Body() dto: RequestRefundDto,
  ) {
    return this.requestRefundHandler.execute({
      ...dto,
      clientId: client.id,
    });
  }
}