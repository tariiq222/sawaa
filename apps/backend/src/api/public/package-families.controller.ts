import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/guards/jwt.guard';
import { ApiPublicResponses } from '../../common/swagger';
import { ListPublicPackageFamiliesHandler } from '../../modules/org-experience/package-families/list-public-package-families/list-public-package-families.handler';
import { GetPublicPackageFamilyHandler } from '../../modules/org-experience/package-families/get-public-package-family/get-public-package-family.handler';
import { PublicPackageFamilyWithVatResponseDto } from './package-response.dto';

@ApiTags('Public / Package Families') @ApiPublicResponses() @Controller('public/package-families')
export class PublicPackageFamiliesController {
  constructor(private readonly listFamilies: ListPublicPackageFamiliesHandler, private readonly getFamily: GetPublicPackageFamilyHandler) {}
  @Public() @Throttle({ default: { ttl: 60_000, limit: 30 } }) @Get() @ApiOperation({ summary: 'Get public package families' }) @ApiOkResponse({ type: [PublicPackageFamilyWithVatResponseDto], description: 'Public package families with sellable options' })
  list(): Promise<PublicPackageFamilyWithVatResponseDto[]> { return this.listFamilies.execute(); }
  @Public() @Throttle({ default: { ttl: 60_000, limit: 30 } }) @Get(':familyId') @ApiOperation({ summary: 'Get one public package family' }) @ApiParam({ name: 'familyId', description: 'Package family UUID' }) @ApiOkResponse({ type: PublicPackageFamilyWithVatResponseDto, description: 'Public package family details' }) @ApiNotFoundResponse({ description: 'Family not found or not sellable' })
  get(@Param('familyId', ParseUUIDPipe) familyId: string): Promise<PublicPackageFamilyWithVatResponseDto> { return this.getFamily.execute({ familyId }); }
}
