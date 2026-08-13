import { SAUDI_PHONE_REGEX } from '@sawaa/shared/validators/phone';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { NormalizePhone } from '../../../identity/shared/normalize-phone.transform';

export class GuestRequestHandoffDto {
  @ApiProperty({ description: 'Guest display name for reception contact', example: 'سارة أحمد' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  guestName!: string;

  @ApiProperty({ description: 'Validated Saudi mobile number for reception contact', example: '+966501234567' })
  @NormalizePhone()
  @IsString()
  @Matches(SAUDI_PHONE_REGEX)
  guestPhone!: string;
}

export class ClientRequestHandoffDto {
  // Gives class-validator metadata so ValidationPipe can reject every unknown
  // body field while still accepting an empty object.
  @IsOptional()
  @IsIn([undefined])
  private readonly _empty?: never;
}
