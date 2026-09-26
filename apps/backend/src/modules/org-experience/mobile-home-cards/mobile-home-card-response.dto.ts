import { ApiProperty } from '@nestjs/swagger';
import { MobileHomeCardDestination } from '@prisma/client';

export class AdminMobileHomeCardDto {
  @ApiProperty() id!: string;
  @ApiProperty() titleAr!: string;
  @ApiProperty({ type: String, nullable: true }) titleEn!: string | null;
  @ApiProperty({ type: String, nullable: true }) descriptionAr!: string | null;
  @ApiProperty({ type: String, nullable: true }) descriptionEn!: string | null;
  @ApiProperty({ type: String, nullable: true }) imageFileId!: string | null;
  @ApiProperty({ type: String, nullable: true }) imageUrl!: string | null;
  @ApiProperty({ type: String, nullable: true }) imageAltAr!: string | null;
  @ApiProperty({ type: String, nullable: true }) imageAltEn!: string | null;
  @ApiProperty({ enum: MobileHomeCardDestination, nullable: true }) destination!: MobileHomeCardDestination | null;
  @ApiProperty() sortOrder!: number;
  @ApiProperty() isPublished!: boolean;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}

export class PublicMobileHomeCardDto {
  @ApiProperty() id!: string;
  @ApiProperty() titleAr!: string;
  @ApiProperty({ type: String, nullable: true }) titleEn!: string | null;
  @ApiProperty({ type: String, nullable: true }) descriptionAr!: string | null;
  @ApiProperty({ type: String, nullable: true }) descriptionEn!: string | null;
  @ApiProperty({ type: String, nullable: true }) imageUrl!: string | null;
  @ApiProperty({ type: String, nullable: true }) imageAltAr!: string | null;
  @ApiProperty({ type: String, nullable: true }) imageAltEn!: string | null;
  @ApiProperty({ enum: MobileHomeCardDestination, nullable: true }) destination!: MobileHomeCardDestination | null;
}
