import { ApiProperty } from '@nestjs/swagger';
import { MobileHomeCardDestination } from '@prisma/client';

export class AdminMobileHomeCardDto {
  @ApiProperty({ description: 'Unique mobile home card identifier.' }) id!: string;
  @ApiProperty({ description: 'Card title in Arabic.' }) titleAr!: string;
  @ApiProperty({ description: 'Card title in English.', type: String, nullable: true }) titleEn!: string | null;
  @ApiProperty({ description: 'Card description in Arabic.', type: String, nullable: true }) descriptionAr!: string | null;
  @ApiProperty({ description: 'Card description in English.', type: String, nullable: true }) descriptionEn!: string | null;
  @ApiProperty({ description: 'Identifier of the uploaded card image.', type: String, nullable: true }) imageFileId!: string | null;
  @ApiProperty({ description: 'URL of the card image.', type: String, nullable: true }) imageUrl!: string | null;
  @ApiProperty({ description: 'Alternative text for the card image in Arabic.', type: String, nullable: true }) imageAltAr!: string | null;
  @ApiProperty({ description: 'Alternative text for the card image in English.', type: String, nullable: true }) imageAltEn!: string | null;
  @ApiProperty({ description: 'In-app destination opened when the card is selected.', enum: MobileHomeCardDestination, nullable: true }) destination!: MobileHomeCardDestination | null;
  @ApiProperty({ description: 'Card display order; lower values appear first.' }) sortOrder!: number;
  @ApiProperty({ description: 'Whether the card is published for mobile clients.' }) isPublished!: boolean;
  @ApiProperty({ description: 'Timestamp when the card was created.', format: 'date-time' }) createdAt!: string;
  @ApiProperty({ description: 'Timestamp when the card was last updated.', format: 'date-time' }) updatedAt!: string;
}

export class PublicMobileHomeCardDto {
  @ApiProperty({ description: 'Unique mobile home card identifier.' }) id!: string;
  @ApiProperty({ description: 'Card title in Arabic.' }) titleAr!: string;
  @ApiProperty({ description: 'Card title in English.', type: String, nullable: true }) titleEn!: string | null;
  @ApiProperty({ description: 'Card description in Arabic.', type: String, nullable: true }) descriptionAr!: string | null;
  @ApiProperty({ description: 'Card description in English.', type: String, nullable: true }) descriptionEn!: string | null;
  @ApiProperty({ description: 'URL of the card image.', type: String, nullable: true }) imageUrl!: string | null;
  @ApiProperty({ description: 'Alternative text for the card image in Arabic.', type: String, nullable: true }) imageAltAr!: string | null;
  @ApiProperty({ description: 'Alternative text for the card image in English.', type: String, nullable: true }) imageAltEn!: string | null;
  @ApiProperty({ description: 'In-app destination opened when the card is selected.', enum: MobileHomeCardDestination, nullable: true }) destination!: MobileHomeCardDestination | null;
}
