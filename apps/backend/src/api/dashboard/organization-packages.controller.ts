import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags, ApiBearerAuth, ApiOperation, ApiParam,
  ApiOkResponse, ApiCreatedResponse, ApiNoContentResponse, ApiResponse,
} from '@nestjs/swagger';
import { ApiStandardResponses } from '../../common/swagger';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard, CheckPermissions } from '../../common/guards/casl.guard';
import { CreateSessionPackageHandler } from '../../modules/org-experience/session-packages/create-session-package/create-session-package.handler';
import { CreateSessionPackageDto } from '../../modules/org-experience/session-packages/create-session-package/create-session-package.dto';
import { UpdateSessionPackageHandler } from '../../modules/org-experience/session-packages/update-session-package/update-session-package.handler';
import { UpdateSessionPackageDto } from '../../modules/org-experience/session-packages/update-session-package/update-session-package.dto';
import { ListSessionPackagesHandler } from '../../modules/org-experience/session-packages/list-session-packages/list-session-packages.handler';
import { ListSessionPackagesDto } from '../../modules/org-experience/session-packages/list-session-packages/list-session-packages.dto';
import { GetSessionPackageHandler } from '../../modules/org-experience/session-packages/get-session-package/get-session-package.handler';
import { ArchiveSessionPackageHandler } from '../../modules/org-experience/session-packages/archive-session-package/archive-session-package.handler';
import { AuditControllerName } from '../../common/interceptors/audit-controller-name.decorator';

@ApiTags('Dashboard / Org Experience')
@ApiBearerAuth()
@ApiStandardResponses()
@UseGuards(JwtGuard, CaslGuard)
@Controller('dashboard/organization')
@AuditControllerName('DashboardOrganizationSettingsController')
export class DashboardOrganizationPackagesController {
  constructor(
    private readonly createSessionPackage: CreateSessionPackageHandler,
    private readonly updateSessionPackage: UpdateSessionPackageHandler,
    private readonly listSessionPackages: ListSessionPackagesHandler,
    private readonly getSessionPackage: GetSessionPackageHandler,
    private readonly archiveSessionPackage: ArchiveSessionPackageHandler,
  ) {}

  @Post('packages')
  @CheckPermissions({ action: 'create', subject: 'Service' })
  @ApiOperation({ summary: 'Create a session package' })
  @ApiCreatedResponse({ description: 'Session package created' })
  @ApiResponse({ status: 400, description: 'Validation failed (invalid items, missing employee-service link, or invalid discount)' })
  createSessionPackageEndpoint(@Body() body: CreateSessionPackageDto) {
    return this.createSessionPackage.execute(body);
  }

  @Get('packages')
  @CheckPermissions({ action: 'read', subject: 'Service' })
  @ApiOperation({ summary: 'List session packages' })
  @ApiOkResponse({ description: 'Paginated list of session packages' })
  listSessionPackagesEndpoint(@Query() query: ListSessionPackagesDto) {
    return this.listSessionPackages.execute(query);
  }

  @Get('packages/:packageId')
  @CheckPermissions({ action: 'read', subject: 'Service' })
  @ApiOperation({ summary: 'Get a session package by id' })
  @ApiParam({ name: 'packageId', description: 'Session package UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'Session package details including the computed price' })
  @ApiResponse({ status: 404, description: 'Session package not found' })
  getSessionPackageEndpoint(@Param('packageId', ParseUUIDPipe) packageId: string) {
    return this.getSessionPackage.execute({ packageId });
  }

  @Patch('packages/:packageId')
  @CheckPermissions({ action: 'update', subject: 'Service' })
  @ApiOperation({ summary: 'Update a session package' })
  @ApiParam({ name: 'packageId', description: 'Session package UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'Session package updated' })
  @ApiResponse({ status: 400, description: 'Validation failed (invalid items or invalid discount)' })
  @ApiResponse({ status: 404, description: 'Session package not found' })
  updateSessionPackageEndpoint(
    @Param('packageId', ParseUUIDPipe) packageId: string,
    @Body() body: UpdateSessionPackageDto,
  ) {
    // Path param must win — body's `packageId` (if any) is not part of the API contract.
    return this.updateSessionPackage.execute({ ...body, packageId });
  }

  @Delete('packages/:packageId')
  @CheckPermissions({ action: 'delete', subject: 'Service' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Archive a session package' })
  @ApiParam({ name: 'packageId', description: 'Session package UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiNoContentResponse({ description: 'Session package archived' })
  @ApiResponse({ status: 404, description: 'Session package not found' })
  archiveSessionPackageEndpoint(@Param('packageId', ParseUUIDPipe) packageId: string) {
    return this.archiveSessionPackage.execute({ packageId });
  }
}
