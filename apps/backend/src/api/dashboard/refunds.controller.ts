import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse, ApiQuery, ApiBearerAuth, ApiProperty, ApiResponse } from '@nestjs/swagger';
import { IsUUID, IsString, IsNotEmpty } from 'class-validator';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard, CheckPermissions } from '../../common/guards/casl.guard';
import { CurrentUser, JwtUser } from '../../common/auth/current-user.decorator';
import { ListRefundsHandler } from '../../modules/finance/refund-payment/list-refunds.handler';
import { ApproveRefundHandler } from '../../modules/finance/refund-payment/approve-refund.handler';
import { DenyRefundHandler } from '../../modules/finance/refund-payment/deny-refund.handler';
import { ApiErrorDto, ApiStandardResponses } from '../../common/swagger';
import {
  RefundApprovalResponseDto,
  RefundRequestListItemDto,
  RefundRequestRecordDto,
} from './dto/refund-response.dto';

class ApproveRefundDto {
  @ApiProperty({ description: 'ID of the refund request to approve', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  refundRequestId!: string;
}

class DenyRefundDto {
  @ApiProperty({ description: 'ID of the refund request to deny', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  refundRequestId!: string;

  @ApiProperty({ description: 'Reason for denying the refund request', example: 'Refund window has expired' })
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

@ApiTags('Dashboard / Refunds')
@ApiBearerAuth()
@ApiStandardResponses()
@Controller('dashboard/refunds')
@UseGuards(JwtGuard, CaslGuard)
export class RefundsController {
  constructor(
    private readonly listRefundsHandler: ListRefundsHandler,
    private readonly approveRefundHandler: ApproveRefundHandler,
    private readonly denyRefundHandler: DenyRefundHandler,
  ) {}

  @Get()
  @CheckPermissions({ action: 'read', subject: 'Payment' })
  @ApiOperation({ summary: 'List refund requests' })
  @ApiQuery({ name: 'status', required: false, type: String, description: 'Filter by refund-request status', example: 'PENDING_REVIEW' })
  @ApiOkResponse({ description: 'Refund requests, newest first (bounded to 100 rows)', type: RefundRequestListItemDto, isArray: true })
  async listRefunds(@Query('status') status?: string): Promise<RefundRequestListItemDto[]> {
    return this.listRefundsHandler.execute(status);
  }

  @Post('approve')
  // Approving a refund moves real money via Moyasar — restrict to OWNER/ADMIN
  // (who hold manage:Setting) and exclude ACCOUNTANT, which only carries
  // manage:Payment for routine invoice/payment work. See casl-ability.factory.
  @CheckPermissions({ action: 'manage', subject: 'Refund' })
  @ApiOperation({ summary: 'Approve a refund request' })
  @ApiOkResponse({ description: 'Approved refund result', type: RefundApprovalResponseDto })
  @ApiResponse({ status: 404, description: 'Refund request not found or not pending review', type: ApiErrorDto })
  async approveRefund(
    @Body() dto: ApproveRefundDto,
    @CurrentUser() user: JwtUser,
  ): Promise<RefundApprovalResponseDto> {
    return this.approveRefundHandler.execute({
      refundRequestId: dto.refundRequestId,
      approvedBy: user.sub,
    });
  }

  @Post('deny')
  // Same restriction as approve — refund decisions are OWNER/ADMIN only.
  @CheckPermissions({ action: 'manage', subject: 'Refund' })
  @ApiOperation({ summary: 'Deny a refund request' })
  @ApiOkResponse({ description: 'Denied refund result', type: RefundRequestRecordDto })
  @ApiResponse({ status: 404, description: 'Refund request not found or not pending review', type: ApiErrorDto })
  async denyRefund(
    @Body() dto: DenyRefundDto,
    @CurrentUser() user: JwtUser,
  ): Promise<RefundRequestRecordDto> {
    return this.denyRefundHandler.execute({
      refundRequestId: dto.refundRequestId,
      deniedBy: user.sub,
      reason: dto.reason,
    });
  }
}
