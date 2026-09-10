import { ApiProperty } from '@nestjs/swagger';
import { ContactMessageStatus } from '@prisma/client';

export class ContactMessageResponseDto {
  @ApiProperty({ description: 'Contact message UUID', example: '00000000-0000-4000-a000-000000000001' })
  id!: string;

  @ApiProperty({ description: 'Sender name', example: 'سارة أحمد' })
  name!: string;

  @ApiProperty({ description: 'Sender phone number', type: String, example: '+966501234567', nullable: true })
  phone!: string | null;

  @ApiProperty({ description: 'Sender email address', type: String, example: 'user@example.com', nullable: true })
  email!: string | null;

  @ApiProperty({ description: 'Message subject', type: String, example: 'استفسار عن الحجز', nullable: true })
  subject!: string | null;

  @ApiProperty({ description: 'Message body', example: 'أرغب بمعرفة المزيد عن الخدمات' })
  body!: string;

  @ApiProperty({ description: 'Message workflow status', enum: ContactMessageStatus, example: 'NEW' })
  status!: ContactMessageStatus;

  @ApiProperty({ description: 'Creation timestamp', type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ description: 'First-read timestamp', type: String, format: 'date-time', nullable: true })
  readAt!: Date | null;

  @ApiProperty({ description: 'Archive timestamp', type: String, format: 'date-time', nullable: true })
  archivedAt!: Date | null;
}

export class ContactMessageListMetaDto {
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

export class PaginatedContactMessagesResponseDto {
  @ApiProperty({ type: [ContactMessageResponseDto], description: 'Contact messages on the requested page' })
  items!: ContactMessageResponseDto[];

  @ApiProperty({ type: ContactMessageListMetaDto, description: 'Pagination metadata' })
  meta!: ContactMessageListMetaDto;
}
