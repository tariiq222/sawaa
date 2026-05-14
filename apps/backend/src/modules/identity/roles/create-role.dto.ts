import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateRoleDto {
  @ApiProperty({ description: 'Display name for the custom role (min 2 characters)', example: 'Reception Manager' })
  @IsString() @MinLength(2) name!: string;
}
