import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateGuestConversationDto {
  @ApiPropertyOptional({ description: 'Optional display name for the guest before sign-in', example: 'سارة أحمد' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  guestName?: string;

  @ApiPropertyOptional({ description: 'Optional Saudi phone number supplied by the guest', example: '+966501234567' })
  @IsOptional()
  @IsString()
  @Matches(/^\+9665\d{8}$/)
  guestPhone?: string;

  @ApiPropertyOptional({ description: 'Preferred chat language', example: 'ar', enum: ['ar', 'en'] })
  @IsOptional()
  @IsIn(['ar', 'en'])
  language?: 'ar' | 'en';
}
