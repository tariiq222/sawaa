import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GetEmailTemplateDto {
  @ApiProperty({ description: 'Email template UUID', example: '00000000-0000-0000-0000-000000000000' })
  @IsUUID() id!: string;
}
