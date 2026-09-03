import { ApiProperty } from '@nestjs/swagger';

export class DiscountReasonResponseDto {
  @ApiProperty({ description: 'Discount reason UUID', example: '00000000-0000-0000-0000-000000000000' })
  id!: string;

  @ApiProperty({ description: 'Reason label in Arabic', example: 'خصم من المعالج' })
  labelAr!: string;

  @ApiProperty({ description: 'Reason label in English', type: String, example: 'Therapist discount', nullable: true })
  labelEn!: string | null;

  @ApiProperty({ description: 'Whether the reason is selectable', example: true })
  isActive!: boolean;

  @ApiProperty({ description: 'Sort order (ascending)', example: 0 })
  sortOrder!: number;

  @ApiProperty({ description: 'Creation timestamp', type: String, format: 'date-time', example: '2026-01-01T00:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ description: 'Last update timestamp', type: String, format: 'date-time', example: '2026-01-01T00:00:00.000Z' })
  updatedAt!: Date;
}
