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
import { CreateCategoryHandler } from '../../modules/org-config/categories/create-category.handler';
import { CreateCategoryDto } from '../../modules/org-config/categories/create-category.dto';
import { UpdateCategoryHandler } from '../../modules/org-config/categories/update-category.handler';
import { UpdateCategoryDto } from '../../modules/org-config/categories/update-category.dto';
import { ListCategoriesHandler } from '../../modules/org-config/categories/list-categories.handler';
import { ListCategoriesDto } from '../../modules/org-config/categories/list-categories.dto';
import { DeleteCategoryHandler } from '../../modules/org-config/categories/delete-category.handler';

@ApiTags('Dashboard / Org Config')
@ApiBearerAuth()
@ApiStandardResponses()
@UseGuards(JwtGuard, CaslGuard)
@Controller('dashboard/organization')
export class DashboardOrganizationCategoriesController {
  constructor(
    private readonly createCategory: CreateCategoryHandler,
    private readonly updateCategory: UpdateCategoryHandler,
    private readonly listCategories: ListCategoriesHandler,
    private readonly deleteCategory: DeleteCategoryHandler,
  ) {}

  @Post('categories')
  @CheckPermissions({ action: 'create', subject: 'Category' })
  @ApiOperation({ summary: 'Create a category' })
  @ApiCreatedResponse({ description: 'Category created' })
  createCategoryEndpoint(@Body() body: CreateCategoryDto) {
    return this.createCategory.execute(body);
  }

  @Get('categories')
  @CheckPermissions({ action: 'read', subject: 'Category' })
  @ApiOperation({ summary: 'List categories' })
  @ApiQuery({ name: 'departmentId', required: false, description: 'Filter by department UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiQuery({ name: 'isActive', required: false, description: 'Filter by active status', example: true })
  @ApiQuery({ name: 'search', required: false, description: 'Search categories by name', example: 'dental' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (1-based)', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: 'Results per page', example: 20 })
  @ApiOkResponse({ description: 'Paginated list of categories' })
  listCategoriesEndpoint(@Query() query: ListCategoriesDto) {
    return this.listCategories.execute(query);
  }

  @Patch('categories/:categoryId')
  @CheckPermissions({ action: 'update', subject: 'Category' })
  @ApiOperation({ summary: 'Update a category' })
  @ApiParam({ name: 'categoryId', description: 'Category UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'Category updated' })
  @ApiResponse({ status: 404, description: 'Category not found', type: ApiErrorDto })
  updateCategoryEndpoint(
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Body() body: UpdateCategoryDto,
  ) {
    return this.updateCategory.execute({ categoryId, ...body });
  }

  @Delete('categories/:categoryId')
  @CheckPermissions({ action: 'delete', subject: 'Category' })
  @ApiOperation({ summary: 'Delete a category' })
  @ApiParam({ name: 'categoryId', description: 'Category UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiNoContentResponse({ description: 'Category deleted' })
  @ApiResponse({ status: 404, description: 'Category not found', type: ApiErrorDto })
  deleteCategoryEndpoint(@Param('categoryId', ParseUUIDPipe) categoryId: string) {
    return this.deleteCategory.execute({ categoryId });
  }
}
