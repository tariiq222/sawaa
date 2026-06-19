import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, ParseUUIDPipe, ParseBoolPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import {
  ApiTags, ApiBearerAuth, ApiOperation, ApiParam, ApiQuery,
  ApiOkResponse, ApiCreatedResponse, ApiResponse, ApiNoContentResponse,
} from '@nestjs/swagger';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard, CheckPermissions } from '../../common/guards/casl.guard';
import { ApiStandardResponses, ApiErrorDto } from '../../common/swagger';
import { ListDiscountReasonsHandler } from '../../modules/org-experience/discount-reasons/list-discount-reasons.handler';
import { CreateDiscountReasonHandler } from '../../modules/org-experience/discount-reasons/create-discount-reason.handler';
import { UpdateDiscountReasonHandler } from '../../modules/org-experience/discount-reasons/update-discount-reason.handler';
import { DeleteDiscountReasonHandler } from '../../modules/org-experience/discount-reasons/delete-discount-reason.handler';
import {
  CreateDiscountReasonDto,
  UpdateDiscountReasonDto,
} from '../../modules/org-experience/discount-reasons/discount-reason.dto';

@ApiTags('Dashboard / Org Experience')
@ApiBearerAuth()
@ApiStandardResponses()
@UseGuards(JwtGuard, CaslGuard)
@Controller('dashboard/discount-reasons')
export class DashboardDiscountReasonsController {
  constructor(
    private readonly listReasons: ListDiscountReasonsHandler,
    private readonly createReason: CreateDiscountReasonHandler,
    private readonly updateReason: UpdateDiscountReasonHandler,
    private readonly deleteReason: DeleteDiscountReasonHandler,
  ) {}

  @Get()
  @CheckPermissions({ action: 'read', subject: 'Setting' })
  @ApiOperation({ summary: 'List discount reasons' })
  @ApiQuery({ name: 'includeInactive', required: false, description: 'Include deactivated reasons', example: false })
  @ApiOkResponse({ description: 'List of discount reasons' })
  listEndpoint(
    @Query('includeInactive', new ParseBoolPipe({ optional: true })) includeInactive?: boolean,
  ) {
    return this.listReasons.execute({ includeInactive });
  }

  @Post()
  @CheckPermissions({ action: 'manage', subject: 'Setting' })
  @ApiOperation({ summary: 'Create a discount reason' })
  @ApiCreatedResponse({ description: 'Discount reason created' })
  createEndpoint(@Body() body: CreateDiscountReasonDto) {
    return this.createReason.execute(body);
  }

  @Patch(':id')
  @CheckPermissions({ action: 'manage', subject: 'Setting' })
  @ApiOperation({ summary: 'Update a discount reason' })
  @ApiParam({ name: 'id', description: 'Discount reason UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'Discount reason updated' })
  @ApiResponse({ status: 404, description: 'Discount reason not found', type: ApiErrorDto })
  updateEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateDiscountReasonDto,
  ) {
    return this.updateReason.execute({ id, ...body });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckPermissions({ action: 'manage', subject: 'Setting' })
  @ApiOperation({ summary: 'Delete a discount reason' })
  @ApiParam({ name: 'id', description: 'Discount reason UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiNoContentResponse({ description: 'Discount reason deleted' })
  @ApiResponse({ status: 404, description: 'Discount reason not found', type: ApiErrorDto })
  @ApiResponse({ status: 409, description: 'Reason is referenced by invoices', type: ApiErrorDto })
  deleteEndpoint(@Param('id', ParseUUIDPipe) id: string) {
    return this.deleteReason.execute({ id });
  }
}
