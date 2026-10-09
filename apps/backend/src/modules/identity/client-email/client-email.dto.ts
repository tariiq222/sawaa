import { Transform } from 'class-transformer';
import { IsEmail, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { normalizeIdentifier } from '../shared/identifier-detector';

export class RequestClientEmailDto {
  @ApiProperty({ description: 'New email to prove ownership of with a six-digit code', example: 'person@example.test' })
  @Transform(({ value }) => typeof value === 'string' ? normalizeIdentifier(value, 'EMAIL') : value)
  @IsEmail({}, { message: 'invalid_email' }) @MaxLength(254)
  email!: string;
}
export class VerifyClientEmailDto {
  @ApiProperty({ description: 'Challenge returned by the request endpoint', format: 'uuid', example: 'b93b1499-dd38-4f61-97bc-e1bd0053903e' })
  @IsUUID('4', { message: 'invalid_or_expired_code' }) challengeId!: string;
  @ApiProperty({ description: 'Six-digit ownership code', example: '123456' })
  @IsString() @Matches(/^\d{6}$/, { message: 'invalid_or_expired_code' }) code!: string;
}
