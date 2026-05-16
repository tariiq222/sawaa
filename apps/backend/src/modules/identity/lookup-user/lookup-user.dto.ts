import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LookupUserDto {
  @ApiProperty({ description: 'User email or phone number', example: 'user@example.com' })
  @IsString()
  identifier!: string;
}
