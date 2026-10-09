import { ApiProperty } from '@nestjs/swagger';

export class ClientPhoneChallengeDto {
  @ApiProperty({ format: 'uuid', example: 'b93b1499-dd38-4f61-97bc-e1bd0053903e' }) challengeId!: string;
  @ApiProperty({ example: '+966***78' }) maskedPhone!: string;
  @ApiProperty({ example: 300 }) expiresIn!: number;
  @ApiProperty({ example: 60 }) retryAfterSeconds!: number;
}

export class ClientPhoneTokensDto {
  @ApiProperty({ description: 'Fresh client access token for this device' }) accessToken!: string;
  @ApiProperty({ description: 'Fresh client refresh token for this device; every other session is revoked' }) refreshToken!: string;
}

export class ClientPhoneVerifiedDto {
  @ApiProperty({ description: 'The newly verified phone', example: '+966512345678' }) phone!: string;
  @ApiProperty({
    type: ClientPhoneTokensDto,
    description: 'Fresh session for this device; every previous token of the client is revoked',
    example: { accessToken: 'eyJhbGciOi...', refreshToken: 'rt_...' },
  }) tokens!: ClientPhoneTokensDto;
}
