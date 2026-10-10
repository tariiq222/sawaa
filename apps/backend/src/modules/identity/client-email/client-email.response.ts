import { ApiProperty } from '@nestjs/swagger';

export type ClientEmailStatusValue = 'none' | 'unverified' | 'pending' | 'verified';

export class ClientEmailStatusDto {
  @ApiProperty({ enum: ['none', 'unverified', 'pending', 'verified'], description: 'Precedence: verified > pending > unverified > none' })
  status!: ClientEmailStatusValue;
  @ApiProperty({ nullable: true, description: 'Returned only when the email is verified; a legacy unverified value is never exposed', example: 'person@example.test' })
  email!: string | null;
  @ApiProperty({ nullable: true, description: 'Client-entered email awaiting proof of ownership', example: 'new@example.test' })
  pendingEmail!: string | null;
  @ApiProperty({ description: 'Whether the one-time "add your email" prompt should be shown', example: false })
  prompt!: boolean;
}

export class ClientEmailChallengeDto {
  @ApiProperty({ format: 'uuid', example: 'b93b1499-dd38-4f61-97bc-e1bd0053903e' }) challengeId!: string;
  @ApiProperty({ example: 'p***@example.test' }) maskedEmail!: string;
  @ApiProperty({ example: 300 }) expiresIn!: number;
  @ApiProperty({ example: 60 }) retryAfterSeconds!: number;
}
