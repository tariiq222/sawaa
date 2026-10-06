import { ApiProperty } from '@nestjs/swagger';
export class EmailEntryTokensDto {
  @ApiProperty({ description: 'Native access token for the returned session namespace', example: 'synthetic-access-token' }) accessToken!: string;
  @ApiProperty({ description: 'Native refresh token to persist only after authenticated success', example: 'synthetic-refresh-token' }) refreshToken!: string;
}
export class EmailEntrySessionDto {
  @ApiProperty({ description: 'Authenticated outcome discriminator', enum: ['authenticated'], example: 'authenticated' }) next!: 'authenticated';
  @ApiProperty({ description: 'Native access and refresh token pair', type: EmailEntryTokensDto, example: { accessToken: 'synthetic-access-token', refreshToken: 'synthetic-refresh-token' } }) tokens!: EmailEntryTokensDto;
  @ApiProperty({ description: 'Session namespace used to select the matching profile and app navigation', enum: ['client', 'staff'], example: 'client' }) sessionKind!: 'client' | 'staff';
}
export class EmailEntryChallengeDto {
  @ApiProperty({ description: 'Opaque identifier of the delivered email ownership challenge', format: 'uuid', example: 'b93b1499-dd38-4f61-97bc-e1bd0053903e' }) challengeId!: string;
  @ApiProperty({ description: 'Masked destination for the email ownership code', example: 'p***@example.test' }) maskedEmail!: string;
  @ApiProperty({ description: 'Email challenge lifetime in seconds', enum: [300], example: 300 }) expiresIn!: 300;
  @ApiProperty({ description: 'Minimum number of seconds before requesting another email code', enum: [60], example: 60 }) retryAfterSeconds!: 60;
}
export class EmailEntryContinueDto {
  @ApiProperty({ description: 'Required next step after successful email ownership proof', enum: ['register', 'verify_phone'], example: 'register' }) next!: 'register' | 'verify_phone';
  @ApiProperty({ description: 'Opaque continuation secret held only in memory; never an access token', example: 'x'.repeat(43) }) continuationToken!: string;
  @ApiProperty({ description: 'Normalized email whose ownership has been proven', example: 'person@example.test' }) email!: string;
  @ApiProperty({ description: 'Maximum continuation lifetime in seconds; subsequent sends never extend it', enum: [600], example: 600 }) expiresIn!: 600;
}
export class EmailEntryUnavailableDto {
  @ApiProperty({ description: 'Generic outcome when this identity cannot continue through email entry', enum: ['unavailable'], example: 'unavailable' }) next!: 'unavailable';
}
export class EmailEntryPhoneChallengeDto {
  @ApiProperty({ description: 'Opaque identifier of the current delivered phone challenge', format: 'uuid', example: 'b93b1499-dd38-4f61-97bc-e1bd0053903e' }) phoneChallengeId!: string;
  @ApiProperty({ description: 'Rotated continuation secret replacing the previous value after accepted delivery', example: 'y'.repeat(43) }) continuationToken!: string;
  @ApiProperty({ description: 'Masked destination of the phone ownership code', example: '+966***78' }) maskedPhone!: string;
  @ApiProperty({ description: 'Remaining phone challenge lifetime in seconds, capped by the original continuation expiry', example: 299 }) expiresIn!: number;
  @ApiProperty({ description: 'Minimum number of seconds before requesting another phone code', enum: [60], example: 60 }) retryAfterSeconds!: 60;
}
export type EmailEntryVerified = EmailEntrySessionDto | EmailEntryContinueDto | EmailEntryUnavailableDto;
