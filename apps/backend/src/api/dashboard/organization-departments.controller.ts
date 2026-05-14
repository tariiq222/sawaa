import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags, ApiBearerAuth, ApiOperation, ApiParam, ApiQuery,
  ApiOkResponse, ApiCreatedResponse, ApiNoContentResponse, ApiResponse,
} from '@nestjs/swagger';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard, CheckPermissions } from '../../common/guards/casl.guard';
import { ApiStandardResponses, ApiErrorDto } from '../../common/swagger';
import { CreateDepartmentHandler } from '../../modules/org-config/departments/create-department.handler';
import { CreateDepartmentDto } from '../../modules/org-config/departments/create-department.dto';
import { UpdateDepartmentHandler } from '../../modules/org-config/departments/update-department.handler';
import { UpdateDepartmentDto } from '../../modules/org-config/departments/update-department.dto';
import { ListDepartmentsHandler } from '../../modules/org-config/departments/list-departments.handler';
import { ListDepartmentsDto } from '../../modules/org-config/departments/list-departments.dto';
import { DeleteDepartmentHandler } from '../../modules/org-config/departments/delete-department.handler';

@ApiTags('Dashboard / Org Config')
@ApiBearerAuth()
@ApiStandardResponses()
@UseGuards(JwtGuard, CaslGuard)
@Controller('dashboard/organization')
export class DashboardOrganizationDepartmentsController {
  constructor(
    private readonly createDepartment: CreateDepartmentHandler,
    private readonly updateDepartment: UpdateDepartmentHandler,
    private readonly listDepartments: ListDepartmentsHandler,
    private readonly deleteDepartment: DeleteDepartmentHandler,
  ) {}

  @Post('departments')
  @CheckPermissions({ action: 'create', subject: 'Department' })
  @ApiOperation({ summary: 'Create a department' })
  @ApiCreatedResponse({ description: 'Department created' })
  createDepartmentEndpoint(@Body() body: CreateDepartmentDto) {
    return this.createDepartment.execute(body);
  }

  @Get('departments')
  @CheckPermissions({ action: 'read', subject: 'Department' })
  @ApiOperation({ summary: 'List departments' })
  @ApiQuery({ name: 'isActive', required: false, description: 'Filter by active status', example: true })
  @ApiQuery({ name: 'search', required: false, description: 'Search departments by name', example: 'dental' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (1-based)', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: 'Results per page', example: 20 })
  @ApiOkResponse({ description: 'Paginated list of departments' })
  listDepartmentsEndpoint(@Query() query: ListDepartmentsDto) {
    return this.listDepartments.execute(query);
  }

  @Patch('departments/:departmentId')
  @CheckPermissions({ action: 'update', subject: 'Department' })
  @ApiOperation({ summary: 'Update a department' })
  @ApiParam({ name: 'departmentId', description: 'Department UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'Department updated' })
  @ApiResponse({ status: 404, description: 'Department not found', type: ApiErrorDto })
  updateDepartmentEndpoint(
    @Param('departmentId', ParseUUIDPipe) departmentId: string,
    @Body() body: UpdateDepartmentDto,
  ) {
    return this.updateDepartment.execute({ departmentId, ...body });
  }

  @Delete('departments/:departmentId')
  @CheckPermissions({ action: 'delete', subject: 'Department' })
  @ApiOperation({ summary: 'Delete a department' })
  @ApiParam({ name: 'departmentId', description: 'Department UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiNoContentResponse({ description: 'Department deleted' })
  @ApiResponse({ status: 404, description: 'Department not found', type: ApiErrorDto })
  deleteDepartmentEndpoint(@Param('departmentId', ParseUUIDPipe) departmentId: string) {
    return this.deleteDepartment.execute({ departmentId });
  }
}
