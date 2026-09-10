import { ApiProperty } from '@nestjs/swagger';

export class BranchResponseDto {
  @ApiProperty({ description: 'Branch UUID', example: '00000000-0000-4000-a000-000000000001' })
  id!: string;

  @ApiProperty({ description: 'Arabic branch name', example: 'فرع الرياض' })
  nameAr!: string;

  @ApiProperty({ description: 'English branch name', type: String, example: 'Riyadh Branch', nullable: true })
  nameEn!: string | null;

  @ApiProperty({ description: 'Branch phone number', type: String, example: '+966112345678', nullable: true })
  phone!: string | null;

  @ApiProperty({ description: 'Arabic address', type: String, example: 'شارع الملك فهد، الرياض', nullable: true })
  addressAr!: string | null;

  @ApiProperty({ description: 'English address', type: String, example: 'King Fahd Road, Riyadh', nullable: true })
  addressEn!: string | null;

  @ApiProperty({ description: 'City', type: String, example: 'Riyadh', nullable: true })
  city!: string | null;

  @ApiProperty({ description: 'ISO country code', example: 'SA' })
  country!: string;

  @ApiProperty({ description: 'GPS latitude', type: Number, example: 24.7136, nullable: true })
  latitude!: number | null;

  @ApiProperty({ description: 'GPS longitude', type: Number, example: 46.6753, nullable: true })
  longitude!: number | null;

  @ApiProperty({ description: 'Whether the branch is active', example: true })
  isActive!: boolean;

  @ApiProperty({ description: 'Whether this is the main branch', example: true })
  isMain!: boolean;

  @ApiProperty({ description: 'IANA timezone identifier', example: 'Asia/Riyadh' })
  timezone!: string;

  @ApiProperty({ description: 'Creation timestamp', type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ description: 'Last update timestamp', type: String, format: 'date-time' })
  updatedAt!: Date;
}

export class BranchBusinessHourResponseDto {
  @ApiProperty({ description: 'Business-hour record UUID', example: '00000000-0000-4000-a000-000000000010' })
  id!: string;

  @ApiProperty({ description: 'Branch UUID', example: '00000000-0000-4000-a000-000000000001' })
  branchId!: string;

  @ApiProperty({ description: 'Day of week, from Sunday (0) to Saturday (6)', example: 0 })
  dayOfWeek!: number;

  @ApiProperty({ description: 'Opening time in HH:mm format', example: '09:00' })
  startTime!: string;

  @ApiProperty({ description: 'Closing time in HH:mm format', example: '17:00' })
  endTime!: string;

  @ApiProperty({ description: 'Whether the branch is open on this day', example: true })
  isOpen!: boolean;

  @ApiProperty({ description: 'Creation timestamp', type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ description: 'Last update timestamp', type: String, format: 'date-time' })
  updatedAt!: Date;
}

export class BranchHolidayResponseDto {
  @ApiProperty({ description: 'Holiday record UUID', example: '00000000-0000-4000-a000-000000000020' })
  id!: string;

  @ApiProperty({ description: 'Branch UUID', example: '00000000-0000-4000-a000-000000000001' })
  branchId!: string;

  @ApiProperty({ description: 'Holiday date', type: String, format: 'date-time', example: '2026-09-23T00:00:00.000Z' })
  date!: Date;

  @ApiProperty({ description: 'Arabic holiday name', example: 'اليوم الوطني' })
  nameAr!: string;

  @ApiProperty({ description: 'English holiday name', type: String, example: 'National Day', nullable: true })
  nameEn!: string | null;

  @ApiProperty({ description: 'Creation timestamp', type: String, format: 'date-time' })
  createdAt!: Date;
}

export class BranchDetailResponseDto extends BranchResponseDto {
  @ApiProperty({ type: [BranchBusinessHourResponseDto], description: 'Weekly business hours' })
  businessHours!: BranchBusinessHourResponseDto[];

  @ApiProperty({ type: [BranchHolidayResponseDto], description: 'Branch holidays' })
  holidays!: BranchHolidayResponseDto[];
}

export class BranchListMetaDto {
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

export class PaginatedBranchesDto {
  @ApiProperty({ type: [BranchResponseDto], description: 'Branches on the requested page' })
  items!: BranchResponseDto[];

  @ApiProperty({ type: BranchListMetaDto, description: 'Pagination metadata' })
  meta!: BranchListMetaDto;
}

export class BranchEmployeeAssignmentResponseDto {
  @ApiProperty({ description: 'Assignment UUID', example: '00000000-0000-4000-a000-000000000003' })
  id!: string;

  @ApiProperty({ description: 'Employee UUID', example: '00000000-0000-4000-a000-000000000002' })
  employeeId!: string;

  @ApiProperty({ description: 'Branch UUID', example: '00000000-0000-4000-a000-000000000001' })
  branchId!: string;
}

export class BranchAssignmentDeletedResponseDto {
  @ApiProperty({ description: 'Deleted assignment UUID', example: '00000000-0000-4000-a000-000000000003' })
  id!: string;
}
