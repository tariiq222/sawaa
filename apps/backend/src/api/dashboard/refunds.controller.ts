import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse, ApiQuery, ApiBearerAuth, ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsString, IsNotEmpty } from 'class-validator';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard, CheckPermissions } from '../../common/guards/casl.guard';
import { CurrentUser, JwtUser } from '../../common/auth/current-user.decorator';
import { ListRefundsHandler } from '../../modules/finance/refund-payment/list-refunds.handler';
import { ApproveRefundHandler } from '../../modules/finance/refund-payment/approve-refund.handler';
import { DenyRefundHandler } from '../../modules/finance/refund-payment/deny-refund.handler';

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
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiOkResponse({ schema: { type: 'object', properties: { data: { type: 'array', items: { type: 'object' } }, total: { type: 'number' } } } })
  async listRefunds(@Query('status') status?: string) {
    return this.listRefundsHandler.execute(status);
  }

  @Post('approve')
  // Approving a refund moves real money via Moyasar — restrict to OWNER/ADMIN
  // (who hold manage:Setting) and exclude ACCOUNTANT, which only carries
  // manage:Payment for routine invoice/payment work. See casl-ability.factory.
  @CheckPermissions({ action: 'manage', subject: 'Setting' })
  @ApiOperation({ summary: 'Approve a refund request' })
  @ApiOkResponse({ schema: { type: 'object', description: 'Approved refund result' } })
  async approveRefund(
    @Body() dto: ApproveRefundDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.approveRefundHandler.execute({
      refundRequestId: dto.refundRequestId,
      approvedBy: user.sub,
    });
  }

  @Post('deny')
  // Same restriction as approve — refund decisions are OWNER/ADMIN only.
  @CheckPermissions({ action: 'manage', subject: 'Setting' })
  @ApiOperation({ summary: 'Deny a refund request' })
  @ApiOkResponse({ schema: { type: 'object', description: 'Denied refund result' } })
  async denyRefund(
    @Body() dto: DenyRefundDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.denyRefundHandler.execute({
      refundRequestId: dto.refundRequestId,
      deniedBy: user.sub,
      reason: dto.reason,
    });
  }
}
