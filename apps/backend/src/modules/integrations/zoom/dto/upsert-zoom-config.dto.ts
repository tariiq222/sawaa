import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpsertZoomConfigDto {
  @ApiProperty({ example: 'your_client_id' })
  @IsString()
  @IsNotEmpty()
  zoomClientId!: string;

  @ApiProperty({ example: 'your_client_secret' })
  @IsString()
  @IsNotEmpty()
  zoomClientSecret!: string;

  @ApiProperty({ example: 'your_account_id' })
  @IsString()
  @IsNotEmpty()
  zoomAccountId!: string;
}
