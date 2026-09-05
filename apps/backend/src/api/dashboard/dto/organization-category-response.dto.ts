import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import { CategoryBookingMode } from '@prisma/client';

export class CategoryResponseDto {
  @ApiProperty({ description: 'Category UUID', example: '00000000-0000-4000-a000-000000000001' })
  id!: string;

  @ApiProperty({ description: 'Sequential category reference', example: 101 })
  ref!: number;

  @ApiProperty({ description: 'Owning department UUID', type: String, nullable: true })
  departmentId!: string | null;

  @ApiProperty({ description: 'Arabic category name', example: 'الإرشاد الأسري' })
  nameAr!: string;

  @ApiProperty({ description: 'English category name', type: String, example: 'Family Guidance', nullable: true })
  nameEn!: string | null;

  @ApiProperty({ description: 'Category display order', example: 0 })
  sortOrder!: number;

  @ApiProperty({ description: 'Whether the category is active', example: true })
  isActive!: boolean;

  @ApiProperty({ description: 'Category booking mode', enum: CategoryBookingMode, example: CategoryBookingMode.SERVICES })
  bookingMode!: CategoryBookingMode;

  @ApiProperty({ description: 'Displayable category image URL; stored keys are signed at read/create/update response time', type: String, nullable: true })
  imageUrl!: string | null;

  @ApiProperty({ description: 'Category icon name', type: String, example: 'family', nullable: true })
  iconName!: string | null;

  @ApiProperty({ description: 'Category icon background color', type: String, example: '#F0F4FF', nullable: true })
  iconBgColor!: string | null;

  @ApiProperty({ description: 'Creation timestamp', type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ description: 'Last update timestamp', type: String, format: 'date-time' })
  updatedAt!: Date;
}

export class CategoryDepartmentResponseDto {
  @ApiProperty({ description: 'Department UUID', example: '00000000-0000-4000-a000-000000000002' })
  id!: string;

  @ApiProperty({ description: 'Arabic department name', example: 'قسم الاستشارات الأسرية' })
  nameAr!: string;

  @ApiProperty({ description: 'English department name', type: String, example: 'Family Counseling', nullable: true })
  nameEn!: string | null;
}

export class CategoryCountResponseDto {
  @ApiProperty({ description: 'Effective bookable service count', example: 3 })
  services!: number;
}

@ApiExtraModels(CategoryDepartmentResponseDto)
export class CategoryListItemResponseDto extends CategoryResponseDto {
  @ApiProperty({
    oneOf: [
      { $ref: getSchemaPath(CategoryDepartmentResponseDto) },
      { type: 'object', nullable: true, enum: [null] },
    ],
    description: 'Owning department, when assigned',
  })
  department!: CategoryDepartmentResponseDto | null;

  @ApiProperty({ type: CategoryCountResponseDto, description: 'Bookable service counts' })
  _count!: CategoryCountResponseDto;
}

export class CategoryListMetaDto {
  @ApiProperty({ description: 'Total matching records', example: 42 })
  total!: number;

  @ApiProperty({ description: '1-based page number', example: 1 })
  page!: number;

  @ApiProperty({ description: 'Records per page', example: 20 })
  limit!: number;

  @ApiProperty({ description: 'Total number of pages', example: 3 })
  totalPages!: number;

  @ApiProperty({ description: 'Whether a next page exists', example: true })
  hasNextPage!: boolean;

  @ApiProperty({ description: 'Whether a previous page exists', example: false })
  hasPreviousPage!: boolean;
}

export class PaginatedCategoriesResponseDto {
  @ApiProperty({ type: [CategoryListItemResponseDto], description: 'Categories on the requested page' })
  items!: CategoryListItemResponseDto[];

  @ApiProperty({ type: CategoryListMetaDto, description: 'Pagination metadata' })
  meta!: CategoryListMetaDto;
}

export class DeleteCategoryResponseDto extends CategoryResponseDto {
  @ApiProperty({ description: 'Persisted image reference returned without signing; may be a storage key or legacy external URL', type: String, nullable: true })
  declare imageUrl: string | null;
}
