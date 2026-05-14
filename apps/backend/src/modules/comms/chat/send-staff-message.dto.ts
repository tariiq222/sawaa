import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendStaffMessageDto {
  @ApiProperty({ description: 'Message body text', example: 'Your appointment is confirmed for tomorrow at 10 AM.' })
  @IsString()
  @IsNotEmpty()
  body!: string;
}
