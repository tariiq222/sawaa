import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { DeliveryType, GroupSequenceMode } from '@prisma/client';
import type { GlobalDiscount, PackageModelVersion as PackageModelVersionType } from '@sawaa/shared/types';

export const PackageModelVersion = {
  LEGACY: 'LEGACY',
  GROUPED_V2: 'GROUPED_V2',
} as const satisfies Record<PackageModelVersionType, PackageModelVersionType>;

export enum GlobalDiscountType {
  NONE = 'NONE',
  PERCENTAGE = 'PERCENTAGE',
  FIXED = 'FIXED',
}

export class GlobalDiscountDto {
  @ApiProperty({ description: 'Package-wide discount type', enum: GlobalDiscountType, example: GlobalDiscountType.PERCENTAGE })
  @IsEnum(GlobalDiscountType)
  type!: GlobalDiscount['type'];

  @ApiProperty({ description: 'Percentage from 0 to 100, or fixed amount in integer halalas', minimum: 0, example: 10 })
  @IsNumber()
  @Min(0)
  value!: number;
}

/** Runtime DTO class plus the shared discriminated union used by handlers. */
export type DiscriminatedGlobalDiscountDto = GlobalDiscountDto & GlobalDiscount;

export class GroupedPackageSessionDto {
  @ApiProperty({ description: 'Stable editor key for this session', example: 'session-1' })
  @IsString()
  @IsNotEmpty()
  key!: string;

  @ApiProperty({ description: 'Zero-based position within the group', minimum: 0, example: 0 })
  @IsInt()
  @Min(0)
  position!: number;

  @ApiProperty({ description: 'Active service duration option UUID', format: 'uuid', example: '00000000-0000-4000-a000-000000000003' })
  @IsUUID()
  durationOptionId!: string;

  @ApiProperty({ description: 'Delivery channel', enum: DeliveryType, example: DeliveryType.IN_PERSON })
  @IsEnum(DeliveryType)
  deliveryType!: DeliveryType;

  @ApiProperty({ description: 'Package override price in integer halalas', minimum: 0, example: 25000 })
  @IsInt()
  @Min(0)
  unitPrice!: number;
}

export class GroupedPackageGroupDto {
  @ApiProperty({ description: 'Stable editor key for this group', example: 'group-1' })
  @IsString()
  @IsNotEmpty()
  key!: string;

  @ApiPropertyOptional({ description: 'Optional group label', example: 'المرحلة الأولى' })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiProperty({ description: 'Service UUID', format: 'uuid', example: '00000000-0000-4000-a000-000000000001' })
  @IsUUID()
  serviceId!: string;

  @ApiProperty({ description: 'Practitioner UUID', format: 'uuid', example: '00000000-0000-4000-a000-000000000002' })
  @IsUUID()
  employeeId!: string;

  @ApiProperty({ description: 'Session sequence behavior', enum: GroupSequenceMode, example: GroupSequenceMode.ORDERED })
  @IsEnum(GroupSequenceMode)
  sequenceMode!: GroupSequenceMode;

  @ApiPropertyOptional({ description: 'Stable key of the group that must complete first', nullable: true, example: null })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  dependsOnGroupKey?: string | null;

  @ApiProperty({ description: 'Explicit sessions in this group', type: [GroupedPackageSessionDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => GroupedPackageSessionDto)
  sessions!: GroupedPackageSessionDto[];
}

export class GroupedPackageInputDto {
  @ApiProperty({ description: 'Grouped catalog model version', enum: [PackageModelVersion.GROUPED_V2], example: PackageModelVersion.GROUPED_V2 })
  @IsEnum(PackageModelVersion)
  modelVersion!: typeof PackageModelVersion.GROUPED_V2;

  @ApiProperty({ description: 'Ordered package groups', type: [GroupedPackageGroupDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => GroupedPackageGroupDto)
  groups!: GroupedPackageGroupDto[];

  @ApiProperty({ description: 'One global package discount', type: GlobalDiscountDto })
  @ValidateNested()
  @Type(() => GlobalDiscountDto)
  globalDiscount!: DiscriminatedGlobalDiscountDto;
}

// Short aliases keep the DTO contract discoverable to callers using the shared
// names while the longer names make Swagger schemas unambiguous.
export {
  GroupedPackageGroupDto as PackageGroupInputDto,
  GroupedPackageGroupDto as PackageGroupDto,
  GroupedPackageSessionDto as PackageSessionInputDto,
  GroupedPackageSessionDto as PackageSessionDto,
  GlobalDiscountDto as GlobalDiscountInputDto,
};
