import { IsArray, IsEnum, IsInt, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export enum NotificationChannel {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  PUSH = 'PUSH',
  IN_APP = 'IN_APP',
}

export class QuietHoursDto {
  @IsInt() @Min(0) @Max(23) startHour!: number;
  @IsInt() @Min(0) @Max(23) endHour!: number;
  @IsString() timezone!: string;
}

export class FcmCredentialsDto {
  @IsOptional() @IsString() serverKey?: string;
  @IsOptional() @IsString() projectId?: string;
  @IsOptional() @IsString() clientEmail?: string;
}

export class UpdateNotificationDefaultsDto {
  @IsOptional() @IsArray() @IsEnum(NotificationChannel, { each: true }) defaultChannels?: NotificationChannel[];
  @IsOptional() @ValidateNested() @Type(() => QuietHoursDto) quietHours?: QuietHoursDto;
  @IsOptional() @ValidateNested() @Type(() => FcmCredentialsDto) fcm?: FcmCredentialsDto;
}
