import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class SendChatMessageDto {
  @ApiProperty({ description: 'Message body text', example: 'مرحباً، أحتاج إلى مساعدة.' })
  @IsString()
  @IsNotEmpty()
  body!: string;

  @ApiProperty({ description: 'Client-generated idempotency identifier', example: '00000000-0000-4000-a000-000000000001' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/)
  clientMessageId!: string;
}
