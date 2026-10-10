import { Transform } from 'class-transformer';
import { IsString, IsUUID, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { normalizePhone } from '../shared/identifier-detector';

export const SAUDI_MOBILE = /^\+9665\d{8}$/;

function toCanonicalPhone(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try { return normalizePhone(value); } catch { return value; }
}

export class RequestClientPhoneDto {
  @ApiProperty({ description: 'New Saudi mobile number to prove ownership of with a six-digit SMS code', example: '0512345678' })
  @Transform(({ value }) => toCanonicalPhone(value))
  @IsString({ message: 'invalid_phone' }) @Matches(SAUDI_MOBILE, { message: 'invalid_phone' })
  phone!: string;
}

export class VerifyClientPhoneDto {
  @ApiProperty({ description: 'Challenge returned by the request endpoint', format: 'uuid', example: 'b93b1499-dd38-4f61-97bc-e1bd0053903e' })
  @IsUUID('4', { message: 'invalid_or_expired_code' }) challengeId!: string;
  @ApiProperty({ description: 'Six-digit SMS code sent to the new number', example: '123456' })
  @IsString({ message: 'invalid_or_expired_code' }) @Matches(/^\d{6}$/, { message: 'invalid_or_expired_code' }) code!: string;
}
