import { IsBoolean, IsObject, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpsertIntegrationDto {
  @ApiProperty({ description: 'Integration provider identifier', example: 'MOYASAR' })
  @IsString() provider!: string;

  @ApiProperty({
    description: 'Provider-specific configuration object (keys vary per provider)',
    example: { apiKey: 'sk_test_...', webhookSecret: 'wh_...' },
  })
  @IsObject() config!: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Whether this integration is currently active', example: true })
  @IsOptional() @IsBoolean() isActive?: boolean;
}
