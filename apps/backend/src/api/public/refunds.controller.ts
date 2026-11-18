import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ClientThrottle } from '../../common/throttle/client-throttle';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiCreatedResponse, ApiProperty, ApiPropertyOptional, ApiResponse } from '@nestjs/swagger';
import { IsUUID, IsString, IsOptional } from 'class-validator';
import { ClientSessionGuard } from '../../common/guards/client-session.guard';
import { Public } from '../../common/guards/jwt.guard';
import { ClientSession } from '../../common/auth/client-session.decorator';
import { ApiErrorDto, ApiPublicResponses } from '../../common/swagger';
import { PublicRefundRequestResponseDto } from './public-refund-request-response.dto';
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
// Class-level @Public() exempts from the global admin JwtGuard; the per-method
// @UseGuards(ClientSessionGuard) still enforces client auth.
@Public()
@Controller('public/refunds')
export class PublicRefundsController {
  constructor(private readonly requestRefundHandler: RequestRefundHandler) {}

  @UseGuards(ClientSessionGuard)
  @ClientThrottle('money')
  @Post('request')
  @ApiOperation({ summary: 'Request a refund for an invoice (requires client auth)' })
  @ApiCreatedResponse({
    type: PublicRefundRequestResponseDto,
    description: 'Refund request recorded as PENDING_REVIEW. No money moves on this route; staff review it from the dashboard.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid client session', type: ApiErrorDto })
  @ApiResponse({ status: 404, description: 'Invoice not found for this client', type: ApiErrorDto })
  @ApiResponse({ status: 409, description: 'A refund request already exists for this invoice', type: ApiErrorDto })
  async requestRefund(
    @ClientSession() client: { id: string },
    @Body() dto: RequestRefundDto,
  ): Promise<PublicRefundRequestResponseDto> {
    return this.requestRefundHandler.execute({
      ...dto,
      clientId: client.id,
    });
  }
}