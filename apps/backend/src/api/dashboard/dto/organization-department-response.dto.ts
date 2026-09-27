import { ApiProperty } from '@nestjs/swagger';

export class DepartmentResponseDto {
  @ApiProperty({ description: 'Department UUID', example: '00000000-0000-4000-a000-000000000001' })
  id!: string;

  @ApiProperty({ description: 'Arabic department name', example: 'قسم الاستشارات الأسرية' })
  nameAr!: string;

  @ApiProperty({ description: 'English department name', type: String, example: 'Family Counseling', nullable: true })
  nameEn!: string | null;

  @ApiProperty({ description: 'Arabic department description', type: String, nullable: true })
  descriptionAr!: string | null;

  @ApiProperty({ description: 'English department description', type: String, nullable: true })
  descriptionEn!: string | null;

  @ApiProperty({ description: 'Department icon identifier', type: String, example: 'family', nullable: true })
  icon!: string | null;

  @ApiProperty({ description: 'Whether the department is shown in public navigation', example: true })
  isVisible!: boolean;

  @ApiProperty({ description: 'Department display order', example: 0 })
  sortOrder!: number;

  @ApiProperty({ description: 'Whether the department is active', example: true })
  isActive!: boolean;

  @ApiProperty({ description: 'Creation timestamp', type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ description: 'Last update timestamp', type: String, format: 'date-time' })
  updatedAt!: Date;
}

export class DepartmentCategoryResponseDto {
  @ApiProperty({ description: 'Category UUID', example: '00000000-0000-4000-a000-000000000002' })
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

  @ApiProperty({ description: 'Category booking mode', enum: ['DIRECT', 'SERVICES'], example: 'SERVICES' })
  bookingMode!: 'DIRECT' | 'SERVICES';

  @ApiProperty({ description: 'Category kind, independent of department and name', enum: ['CLINIC', 'SERVICE_GROUP'], example: 'CLINIC' })
  kind!: 'CLINIC' | 'SERVICE_GROUP';

  @ApiProperty({ description: 'Category image URL', type: String, nullable: true })
  imageUrl!: string | null;

  @ApiProperty({ description: 'Category icon name', type: String, nullable: true })
  iconName!: string | null;

  @ApiProperty({ description: 'Category icon background color', type: String, nullable: true })
  iconBgColor!: string | null;

  @ApiProperty({ description: 'Creation timestamp', type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ description: 'Last update timestamp', type: String, format: 'date-time' })
  updatedAt!: Date;
}

export class DepartmentListItemResponseDto extends DepartmentResponseDto {
  @ApiProperty({ type: [DepartmentCategoryResponseDto], description: 'Categories assigned to the department' })
  categories!: DepartmentCategoryResponseDto[];

  @ApiProperty({ description: 'Active categories with at least one bookable option', example: 2 })
  bookableCategoriesCount!: number;
}

export class DepartmentListMetaDto {
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

export class PaginatedDepartmentsResponseDto {
  @ApiProperty({ type: [DepartmentListItemResponseDto], description: 'Departments on the requested page' })
  items!: DepartmentListItemResponseDto[];

  @ApiProperty({ type: DepartmentListMetaDto, description: 'Pagination metadata' })
  meta!: DepartmentListMetaDto;
}

export class DeleteDepartmentResponseDto {
  @ApiProperty({ description: 'Whether the department was deleted', example: true })
  deleted!: boolean;
}
