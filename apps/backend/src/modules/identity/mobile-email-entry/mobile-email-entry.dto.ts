import { Transform } from 'class-transformer';
import { Equals, IsEmail, IsOptional, IsString, IsUUID, Length, Matches, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { normalizeIdentifier } from '../shared/identifier-detector';

export class RequestEmailEntryDto {
  @ApiProperty({ description: 'Email to prove ownership of', example: 'person@example.test' })
  @Transform(({ value }) => typeof value === 'string' ? normalizeIdentifier(value, 'EMAIL') : value)
  @IsEmail() @MaxLength(254)
  email!: string;
}
export class VerifyEmailEntryDto {
  @ApiProperty({ description: 'Email challenge identifier', example: 'b93b1499-dd38-4f61-97bc-e1bd0053903e' })
  @IsUUID() challengeId!: string;
  @ApiProperty({ description: 'Six-digit ownership code', example: '123456' })
  @IsString() @Matches(/^\d{6}$/) code!: string;
}
export class EmailEntryContinuationDto {
  @ApiProperty({ description: 'Opaque ownership continuation; never an access token', example: 'x'.repeat(43) })
  @IsString() @Matches(/^[A-Za-z0-9_-]{43}$/) continuationToken!: string;
}
export class RequestEmailEntryPhoneDto extends EmailEntryContinuationDto {
  @ApiProperty({ description: 'Phone to verify', example: '+966512345678' })
  @Transform(({ value }) => typeof value === 'string' ? normalizeIdentifier(value, 'SMS') : value)
  @IsString() @Matches(/^\+[1-9]\d{7,14}$/) phone!: string;
  @ApiPropertyOptional({ description: 'Required only for new registration', example: 'Ali' })
  @IsOptional() @Transform(({ value }) => typeof value === 'string' ? value.trim() : value) @IsString() @Length(1, 100) firstName?: string;
  @ApiPropertyOptional({ description: 'Required only for new registration', example: 'Saleh' })
  @IsOptional() @Transform(({ value }) => typeof value === 'string' ? value.trim() : value) @IsString() @Length(1, 100) lastName?: string;
  @ApiPropertyOptional({ description: 'Explicit privacy consent required only for new registration', example: true })
  @IsOptional() @Equals(true) privacyAccepted?: true;
}
export class ResendEmailEntryPhoneDto extends EmailEntryContinuationDto {
  @ApiProperty({ description: 'Current phone challenge identifier', example: 'b93b1499-dd38-4f61-97bc-e1bd0053903e' })
  @IsUUID() phoneChallengeId!: string;
}
export class VerifyEmailEntryPhoneDto extends ResendEmailEntryPhoneDto {
  @ApiProperty({ description: 'Six-digit phone ownership code', example: '123456' })
  @IsString() @Matches(/^\d{6}$/) code!: string;
}
