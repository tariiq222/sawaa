import { Controller, Get, Param } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiOkResponse, ApiParam } from '@nestjs/swagger';
import { Public } from '../../common/guards/jwt.guard';
import { ApiPublicResponses } from '../../common/swagger';
import { GetPublicBranchesHandler } from '../../modules/org-config/branches/public/get-public-branches.handler';
import { GetPublicBranchHandler } from '../../modules/org-config/branches/public/get-public-branch.handler';
import { ListPublicBranchEmployeesHandler } from '../../modules/org-config/branches/public/list-public-branch-employees.handler';

@ApiTags('Public / Branches')
@ApiPublicResponses()
@Controller('public/branches')
export class PublicBranchesController {
  constructor(
    private readonly listHandler: GetPublicBranchesHandler,
    private readonly getHandler: GetPublicBranchHandler,
    private readonly employeesHandler: ListPublicBranchEmployeesHandler,
  ) {}

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @Get()
  @ApiOperation({ summary: 'List active branches for the booking wizard' })
  @ApiOkResponse({ description: 'Array of public-safe branch records' })
  list() {
    return this.listHandler.execute();
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @Get(':id')
  @ApiOperation({ summary: 'Get a single active branch by id (public-safe)' })
  @ApiParam({ name: 'id', description: 'Branch id', example: 'b_123' })
  @ApiOkResponse({ description: 'Public-safe branch detail with business hours' })
  getOne(@Param('id') id: string) {
    return this.getHandler.execute(id);
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @Get(':id/employees')
  @ApiOperation({ summary: 'List public employees assigned to a branch' })
  @ApiParam({ name: 'id', description: 'Branch id', example: 'b_123' })
  @ApiOkResponse({ description: 'Public-safe employees linked to the branch' })
  employees(@Param('id') id: string) {
    return this.employeesHandler.execute(id);
  }
}
