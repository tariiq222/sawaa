import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpsertPlatformSettingDto {
  @IsString() @IsNotEmpty() key!: string;
  @IsString() @IsNotEmpty() value!: string;
  @IsString() @IsOptional() secret?: string; // if provided, encrypt before store
}
