import { ApiProperty } from '@nestjs/swagger';
import { EmailEntryTokensDto } from '../mobile-email-entry/mobile-email-entry.response';

export class PhoneEntryChallengeDto {
  @ApiProperty({ description: 'Opaque identifier of the delivered phone ownership challenge', format: 'uuid', example: 'b93b1499-dd38-4f61-97bc-e1bd0053903e' }) challengeId!: string;
  @ApiProperty({ description: 'Masked destination of the phone ownership code', example: '+966***78' }) maskedPhone!: string;
  @ApiProperty({ description: 'Phone challenge lifetime in seconds', enum: [300], example: 300 }) expiresIn!: 300;
  @ApiProperty({ description: 'Minimum seconds before another phone code may be requested', enum: [60], example: 60 }) retryAfterSeconds!: 60;
}
export class PhoneEntrySessionDto {
  @ApiProperty({ description: 'Authenticated outcome discriminator', enum: ['authenticated'], example: 'authenticated' }) next!: 'authenticated';
  @ApiProperty({ description: 'Native client access and refresh token pair', type: EmailEntryTokensDto }) tokens!: EmailEntryTokensDto;
  @ApiProperty({ description: 'Client session namespace; phone entry does not issue staff sessions', enum: ['client'], example: 'client' }) sessionKind!: 'client';
  @ApiProperty({ description: 'Whether to show the unresolved legacy email prompt after authentication', example: false }) emailPrompt!: boolean;
}
export class PhoneEntryContinueDto {
  @ApiProperty({ description: 'Required next step for a proven phone without an existing account', enum: ['register'], example: 'register' }) next!: 'register';
  @ApiProperty({ description: 'Opaque continuation held only in memory; never an access token', example: 'x'.repeat(43) }) continuationToken!: string;
  @ApiProperty({ description: 'Maximum continuation lifetime in seconds', enum: [600], example: 600 }) expiresIn!: 600;
}
export class PhoneEntryUnavailableDto {
  @ApiProperty({ description: 'Generic outcome for an identity unable to use client phone entry', enum: ['unavailable'], example: 'unavailable' }) next!: 'unavailable';
}
export type PhoneEntryVerified = PhoneEntrySessionDto | PhoneEntryContinueDto | PhoneEntryUnavailableDto;
