import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { IsDateString, IsOptional } from 'class-validator';
import {
  ApiTags, ApiBearerAuth, ApiOperation, ApiQuery, ApiOkResponse,
} from '@nestjs/swagger';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ApiStandardResponses } from '../../../common/swagger';
import { JwtGuard } from '../../../common/guards/jwt.guard';
import { CaslGuard, CheckPermissions } from '../../../common/guards/casl.guard';
import { CurrentUser, JwtUser } from '../../../common/auth/current-user.decorator';
import { PrismaService } from '../../../infrastructure/database';
import { resolveEmployeeId } from './resolve-employee-id.helper';
import { GetEmployeeEarningsHandler } from '../../../modules/finance/get-employee-earnings/get-employee-earnings.handler';

export class EarningsQuery {
  @ApiPropertyOptional({ description: 'Start of earnings period (ISO 8601); defaults to first day of current month', example: '2026-04-01' })
  @IsOptional() @IsDateString() from?: string;

  @ApiPropertyOptional({ description: 'End of earnings period (ISO 8601); defaults to last day of current month', example: '2026-04-30' })
  @IsOptional() @IsDateString() to?: string;
}

@ApiTags('Mobile Employee / Earnings')
@ApiBearerAuth()
@ApiStandardResponses()
@UseGuards(JwtGuard, CaslGuard)
@Controller('mobile/employee/earnings')
export class MobileEmployeeEarningsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly getEmployeeEarnings: GetEmployeeEarningsHandler,
  ) {}

  @ApiOperation({ summary: 'Get earnings summary for the authenticated employee within a date range' })
  @ApiOkResponse({
    description: 'Earnings totals (employee commission share) and breakdown by payment method for the requested period',
    schema: {
      type: 'object',
      properties: {
        period: {
          type: 'object',
          properties: {
            from: { type: 'string', format: 'date-time' },
            to: { type: 'string', format: 'date-time' },
          },
        },
        totalEarningsHalalas: {
          type: 'number',
          description: 'Employee commission share in halalas (subtotal × effective commission rate)',
          example: 31500,
        },
        totalRevenueHalalas: {
          type: 'number',
          description: 'Sum of invoice subtotals (pre-VAT) in halalas — gross context figure',
          example: 45000,
        },
        invoiceCount: { type: 'number', example: 12 },
        byMethod: {
          type: 'object',
          description: 'Employee commission share by payment method in halalas — proportionally split from employee total earnings',
          additionalProperties: { type: 'number' },
          example: { ONLINE_CARD: 21000, CASH: 10500 },
        },
      },
    },
  })
  @ApiQuery({ name: 'from', required: false, description: 'Start of earnings period (ISO 8601)', example: '2026-04-01' })
  @ApiQuery({ name: 'to', required: false, description: 'End of earnings period (ISO 8601)', example: '2026-04-30' })
  @Get()
  @CheckPermissions({ action: 'read', subject: 'Employee' })
  async earnings(
    @CurrentUser() user: JwtUser,
    @Query() q: EarningsQuery,
  ) {
    const now = new Date();
    const from = q.from
      ? new Date(q.from)
      : new Date(now.getFullYear(), now.getMonth(), 1);
    const to = q.to
      ? new Date(q.to)
      : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const employeeId = await resolveEmployeeId(this.prisma, user);

    return this.getEmployeeEarnings.execute({ employeeId, from, to });
  }
}
