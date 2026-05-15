import { IsBoolean, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpsertMoyasarConfigDto {
  @ApiProperty({
    description: 'Tenant Moyasar publishable key (pk_test_… or pk_live_…)',
    example: 'pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  })
  @IsString()
  @Matches(/^pk_(test|live)_[A-Za-z0-9]{20,}$/)
  publishableKey!: string;

  @ApiProperty({
    description: 'Tenant Moyasar secret key (sk_test_… or sk_live_…). Stored AES-256-GCM encrypted. Omit to keep existing.',
    example: 'sk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Matches(/^sk_(test|live)_[A-Za-z0-9]{20,}$/)
  secretKey?: string;

  @ApiProperty({
    description: 'Tenant Moyasar webhook signing secret. Omit to keep existing. Stored AES-256-GCM encrypted.',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(256)
  webhookSecret?: string;

  @ApiProperty({
    description: 'true if these are live (production) keys, false for test mode.',
    default: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isLive?: boolean;
}
