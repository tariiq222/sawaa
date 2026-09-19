import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiStandardResponses } from '../../common/swagger';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard, CheckPermissions } from '../../common/guards/casl.guard';
import { CreatePackageFamilyHandler } from '../../modules/org-experience/package-families/create-package-family/create-package-family.handler';
import { UpdatePackageFamilyHandler } from '../../modules/org-experience/package-families/update-package-family/update-package-family.handler';
import { ListPackageFamiliesHandler } from '../../modules/org-experience/package-families/list-package-families/list-package-families.handler';
import { GetPackageFamilyHandler } from '../../modules/org-experience/package-families/get-package-family/get-package-family.handler';
import { ArchivePackageFamilyHandler } from '../../modules/org-experience/package-families/archive-package-family/archive-package-family.handler';
import { CreatePackageFamilyDto, UpdatePackageFamilyDto } from '../../modules/org-experience/package-families/package-family.dto';

@ApiTags('Dashboard / Organization / Package Families')
@ApiBearerAuth()
@ApiStandardResponses()
@UseGuards(JwtGuard, CaslGuard)
@Controller('dashboard/organization/package-families')
export class DashboardPackageFamiliesController {
  constructor(private readonly createFamily: CreatePackageFamilyHandler, private readonly updateFamily: UpdatePackageFamilyHandler, private readonly listFamilies: ListPackageFamiliesHandler, private readonly getFamily: GetPackageFamilyHandler, private readonly archiveFamily: ArchivePackageFamilyHandler) {}
  @Get() @CheckPermissions({ action: 'read', subject: 'Service' }) @ApiOperation({ summary: 'List package families' }) @ApiOkResponse({ description: 'Package families and their grouped options' })
  list() { return this.listFamilies.execute(); }
  @Get(':familyId') @CheckPermissions({ action: 'read', subject: 'Service' }) @ApiOperation({ summary: 'Get a package family' }) @ApiParam({ name: 'familyId', description: 'Package family UUID' }) @ApiOkResponse({ description: 'Package family details' }) @ApiResponse({ status: 404, description: 'Package family not found' })
  get(@Param('familyId', ParseUUIDPipe) familyId: string) { return this.getFamily.execute({ familyId }); }
  @Post() @CheckPermissions({ action: 'create', subject: 'Service' }) @ApiOperation({ summary: 'Create a package family' }) @ApiCreatedResponse({ description: 'Package family created' })
  async create(@Body() body: CreatePackageFamilyDto) {
    const family = await this.createFamily.execute(body);
    return this.getFamily.execute({ familyId: family.id });
  }
  @Patch(':familyId') @CheckPermissions({ action: 'update', subject: 'Service' }) @ApiOperation({ summary: 'Update a package family' }) @ApiParam({ name: 'familyId', description: 'Package family UUID' }) @ApiOkResponse({ description: 'Package family updated' })
  async update(@Param('familyId', ParseUUIDPipe) familyId: string, @Body() body: UpdatePackageFamilyDto) {
    await this.updateFamily.execute({ ...body, familyId });
    return this.getFamily.execute({ familyId });
  }
  @Delete(':familyId') @CheckPermissions({ action: 'delete', subject: 'Service' }) @HttpCode(HttpStatus.NO_CONTENT) @ApiOperation({ summary: 'Archive a package family' }) @ApiParam({ name: 'familyId', description: 'Package family UUID' }) @ApiNoContentResponse({ description: 'Package family archived' }) @ApiResponse({ status: 404, description: 'Package family not found' })
  archive(@Param('familyId', ParseUUIDPipe) familyId: string) { return this.archiveFamily.execute({ familyId }); }
}
