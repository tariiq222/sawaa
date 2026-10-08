import { GetPublicEmployeeImageHandler } from '../../modules/people/employees/public/get-public-employee-image.handler';
import { Controller, Get, Param, Query, Header, Redirect } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiOkResponse, ApiParam, ApiNotFoundResponse, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { Public } from '../../common/guards/jwt.guard';
import { ApiPublicResponses } from '../../common/swagger';
import { PublicEmployeeResponseDto } from '../dashboard/dto/people-response.dto';
import { ListPublicEmployeesHandler } from '../../modules/people/employees/public/list-public-employees.handler';
import { GetPublicEmployeeHandler } from '../../modules/people/employees/public/get-public-employee.handler';

@ApiTags('Public / Employees')
@ApiPublicResponses()
@Controller('public/employees')
export class PublicEmployeesController {
  constructor(
    private readonly listHandler: ListPublicEmployeesHandler,
    private readonly getHandler: GetPublicEmployeeHandler,
    private readonly getImage: GetPublicEmployeeImageHandler,
  ) {}

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 120 } })
  @Get(':key/image')
  @Header('Cache-Control', 'no-store, max-age=0')
  @Redirect('', 302)
  @ApiOperation({ summary: 'Read the selected portrait of an active public employee' })
  @ApiParam({ name: 'key', description: 'Public slug or employee UUID' })
  @ApiResponse({ status: 302, description: 'Redirect to a freshly signed private image URL' })
  @ApiNotFoundResponse({ description: 'Public employee or selected image not found' })
  async image(@Param('key') key: string) {
    return { url: await this.getImage.execute(key) };
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Get()
  @ApiOperation({ summary: 'List public-facing employees' })
  @ApiOkResponse({ type: [PublicEmployeeResponseDto], description: 'Public employees with slug + bio + image' })
  @ApiQuery({ name: 'includeDirectClinics', required: false, type: Boolean, description: 'Include direct clinic booking service links' })
  list(@Query('includeDirectClinics') includeDirectClinics?: string) {
    return this.listHandler.execute({ includeDirectClinics: includeDirectClinics === 'true' });
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Get(':key')
  @ApiOperation({ summary: 'Get single public employee by slug or id' })
  @ApiParam({ name: 'key', description: 'Public slug or employee UUID', example: 'dr-ahmed' })
  @ApiOkResponse({ type: PublicEmployeeResponseDto, description: 'Single public employee' })
  @ApiNotFoundResponse({ description: 'Employee not found' })
  @ApiQuery({ name: 'includeDirectClinics', required: false, type: Boolean, description: 'Include hidden booking links for direct clinics' })
  getOne(@Param('key') key: string, @Query('includeDirectClinics') includeDirectClinics?: string) {
    return this.getHandler.execute(key, { includeDirectClinics: includeDirectClinics === 'true' });
  }
}
