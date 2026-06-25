import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiParam,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { Public } from '../../common/guards/jwt.guard';
import { ApiPublicResponses } from '../../common/swagger';
import { ListPublicPackagesHandler } from '../../modules/org-experience/session-packages/list-public-packages/list-public-packages.handler';
import { GetPublicPackageHandler } from '../../modules/org-experience/session-packages/get-public-package/get-public-package.handler';

/**
 * Public, unauthenticated catalog of self-purchasable session packages
 * (website + mobile). Only public + active + non-archived packages are exposed,
 * each decorated with the canonical computed price. Mirrors the @Public catalog
 * pattern used by PublicCatalogController (no JwtGuard, ApiTags, throttled).
 */
@ApiTags('Public / Catalog')
@ApiPublicResponses()
@Controller('public/packages')
export class PublicPackagesController {
  constructor(
    private readonly listPublicPackages: ListPublicPackagesHandler,
    private readonly getPublicPackage: GetPublicPackageHandler,
  ) {}

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Get()
  @ApiOperation({ summary: 'Get the public session-package catalog' })
  @ApiOkResponse({
    description: 'Public, active session packages with computed prices',
  })
  list() {
    return this.listPublicPackages.execute();
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Get(':packageId')
  @ApiOperation({ summary: 'Get one public session package by id' })
  @ApiParam({
    name: 'packageId',
    description: 'SessionPackage UUID',
    example: '00000000-0000-0000-0000-000000000000',
  })
  @ApiOkResponse({ description: 'The public session package with its computed price' })
  @ApiNotFoundResponse({ description: 'Package not found or not public' })
  get(@Param('packageId', ParseUUIDPipe) packageId: string) {
    return this.getPublicPackage.execute({ packageId });
  }
}
