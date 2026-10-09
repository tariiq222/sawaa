import { Transform } from 'class-transformer';
import { Equals, IsEmail, IsString, IsUUID, Length, Matches, MaxLength, ValidateIf } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { normalizeIdentifier } from '../shared/identifier-detector';

export class RequestPhoneEntryDto {
  @ApiProperty({ description: 'Saudi mobile phone to prove ownership of', example: '+966512345678', pattern: '^\\+9665\\d{8}$' })
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    try { return normalizeIdentifier(value, 'SMS'); } catch { return value; }
  })
  @IsString({ message: 'invalid_phone' })
  @Matches(/^\+9665\d{8}$/, { message: 'invalid_phone' })
  phone!: string;
}
export class ResendPhoneEntryDto {
  @ApiProperty({ description: 'Current phone ownership challenge identifier', format: 'uuid', example: 'b93b1499-dd38-4f61-97bc-e1bd0053903e' })
  @IsUUID(undefined, { message: 'invalid_or_expired_flow' }) challengeId!: string;
}
export class VerifyPhoneEntryDto extends ResendPhoneEntryDto {
  @ApiProperty({ description: 'Exactly six ASCII digits from the delivered ownership code', example: '123456', pattern: '^\\d{6}$' })
  @IsString({ message: 'invalid_or_expired_code' })
  @Matches(/^\d{6}$/, { message: 'invalid_or_expired_code' }) code!: string;
}
export class CompletePhoneEntryDto {
  @ApiProperty({ description: 'Opaque phone ownership continuation; never an access token', example: 'x'.repeat(43), pattern: '^[A-Za-z0-9_-]{43}$' })
  @IsString({ message: 'invalid_or_expired_flow' })
  @Matches(/^[A-Za-z0-9_-]{43}$/, { message: 'invalid_or_expired_flow' }) continuationToken!: string;
  @ApiProperty({ description: 'First name for the new client account', example: 'Ali', minLength: 1, maxLength: 100 })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString({ message: 'invalid_details' }) @Length(1, 100, { message: 'invalid_details' }) firstName!: string;
  @ApiProperty({ description: 'Last name for the new client account', example: 'Saleh', minLength: 1, maxLength: 100 })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString({ message: 'invalid_details' }) @Length(1, 100, { message: 'invalid_details' }) lastName!: string;
  @ApiPropertyOptional({ description: 'Optional pending email; not trusted until ownership is verified', example: 'person@example.test', maxLength: 254 })
  @ValidateIf((_, value) => value !== undefined)
  @IsString({ message: 'invalid_details' })
  @Transform(({ value }) => typeof value === 'string' ? normalizeIdentifier(value, 'EMAIL') : value)
  @IsEmail({}, { message: 'invalid_details' }) @MaxLength(254, { message: 'invalid_details' }) email?: string;
  @ApiProperty({ description: 'Explicit acceptance of the current privacy policy', enum: [true], example: true })
  @Equals(true, { message: 'invalid_details' }) privacyAccepted!: true;
}
