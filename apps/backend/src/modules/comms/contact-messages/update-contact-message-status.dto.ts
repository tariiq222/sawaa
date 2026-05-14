import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ContactMessageStatus } from '@prisma/client';

export class UpdateContactMessageStatusDto {
  @ApiProperty({ description: 'New status', enum: ContactMessageStatus, example: 'READ' })
  @IsEnum(ContactMessageStatus) status!: ContactMessageStatus;
}
