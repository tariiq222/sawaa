import { ApiProperty } from '@nestjs/swagger';

/**
 * Single read model for the authenticated client's own profile. Served by
 * GET/PATCH /public/me and GET/PATCH /mobile/client/profile. Deliberately
 * excludes staff-only and sensitive columns (notes, medical and national-ID
 * data, auth state, deletedAt, consent bookkeeping).
 */
export class ClientProfileDto {
  @ApiProperty({ description: 'Client UUID', example: '00000000-0000-0000-0000-000000000000' })
  id!: string;

  @ApiProperty({ description: 'Full display name', example: 'Sara Al-Harbi' })
  name!: string;

  @ApiProperty({ description: 'First name', type: String, example: 'Sara', nullable: true })
  firstName!: string | null;

  @ApiProperty({ description: 'Last name', type: String, example: 'Al-Harbi', nullable: true })
  lastName!: string | null;

  @ApiProperty({
    description: 'Email address. Null unless the email has been verified.',
    type: String, example: 'sara@example.com', nullable: true,
  })
  email!: string | null;

  @ApiProperty({
    description:
      'Stored email that has not been verified yet (set when emailVerified is null), so the client can see what they entered. Null once the email is verified or when none is stored.',
    type: String, example: 'sara@example.com', nullable: true,
  })
  unverifiedEmail!: string | null;

  @ApiProperty({ description: 'Mobile phone number', type: String, example: '+966501234567', nullable: true })
  phone!: string | null;

  @ApiProperty({ description: 'Email verification timestamp', type: String, format: 'date-time', nullable: true })
  emailVerified!: Date | null;

  @ApiProperty({ description: 'Phone verification timestamp', type: String, format: 'date-time', nullable: true })
  phoneVerified!: Date | null;

  @ApiProperty({ description: 'Avatar image URL', type: String, example: 'https://cdn.example.com/avatars/sara.jpg', nullable: true })
  avatarUrl!: string | null;

  @ApiProperty({ description: 'Gender (lowercase)', enum: ['male', 'female'], nullable: true })
  gender!: 'male' | 'female' | null;

  @ApiProperty({ description: 'Date of birth (ISO 8601)', type: String, format: 'date-time', nullable: true })
  dateOfBirth!: Date | null;

  @ApiProperty({ description: 'Preferred app locale', type: String, example: 'ar', nullable: true })
  preferredLocale!: string | null;

  @ApiProperty({ description: 'Whether push notifications are enabled', example: true })
  pushEnabled!: boolean;

  @ApiProperty({ description: 'Account type', enum: ['full', 'walk_in'], example: 'full' })
  accountType!: 'full' | 'walk_in';

  @ApiProperty({ description: 'Account claim timestamp', type: String, format: 'date-time', nullable: true })
  claimedAt!: Date | null;

  @ApiProperty({ description: 'Creation timestamp', type: String, format: 'date-time' })
  createdAt!: Date;
}
