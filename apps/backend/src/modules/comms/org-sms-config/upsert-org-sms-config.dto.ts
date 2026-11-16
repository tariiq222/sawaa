// SaaS-02g-sms — owner-scoped dto for writing SMS provider config.

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UnifonicCredentialsDto {
  @ApiProperty({ description: 'Unifonic App SID' })
  @IsString()
  @MaxLength(200)
  appSid!: string;

  @ApiProperty({ description: 'Unifonic API key (Bearer token)' })
  @IsString()
  @MaxLength(500)
  apiKey!: string;
}

export class TaqnyatCredentialsDto {
  @ApiProperty({ description: 'Taqnyat API token (Bearer)' })
  @IsString()
  @MaxLength(500)
  apiToken!: string;
}

export class UpsertOrgSmsConfigDto {
  @ApiProperty({
    enum: ['NONE', 'UNIFONIC', 'TAQNYAT'],
    description: 'SMS provider to configure; NONE disables sending and clears stored credentials',
    example: 'TAQNYAT',
  })
  @IsEnum(['NONE', 'UNIFONIC', 'TAQNYAT'])
  provider!: 'NONE' | 'UNIFONIC' | 'TAQNYAT';

  @ApiPropertyOptional({ description: 'Registered sender ID (alphanumeric brand)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  senderId?: string;

  @ApiPropertyOptional({
    type: UnifonicCredentialsDto,
    description: 'Unifonic credentials; required when switching to UNIFONIC, optional to keep the stored ones',
    example: { appSid: 'example-app-sid', apiKey: 'example-api-key' },
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => UnifonicCredentialsDto)
  unifonic?: UnifonicCredentialsDto;

  @ApiPropertyOptional({
    type: TaqnyatCredentialsDto,
    description: 'Taqnyat credentials; required when switching to TAQNYAT, optional to keep the stored ones',
    example: { apiToken: 'example-api-token' },
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => TaqnyatCredentialsDto)
  taqnyat?: TaqnyatCredentialsDto;
}
