import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateMembershipProfileDto {
  @ApiPropertyOptional({ description: 'Per-org display name (overrides User.name).', example: 'د. أحمد المطيري' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayName?: string;

  @ApiPropertyOptional({ description: 'Per-org job title.', example: 'استشاري نفسي' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  jobTitle?: string;

  @ApiPropertyOptional({ description: 'Per-org avatar URL (MinIO).', example: 'https://cdn.example.com/memberships/m-1/avatar.jpg' })
  @IsOptional()
  @IsUrl({ require_tld: false, require_protocol: true })
  @MaxLength(500)
  avatarUrl?: string;
}
