import { IsOptional, IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpsertZoomConfigDto {
  @ApiProperty({ example: 'your_client_id', required: false })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  zoomClientId?: string;

  @ApiProperty({ example: 'your_client_secret', required: false })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  zoomClientSecret?: string;

  @ApiProperty({ example: 'your_account_id', required: false })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  zoomAccountId?: string;
}
