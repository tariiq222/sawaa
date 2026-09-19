import { ApiProperty } from '@nestjs/swagger';

/** Employee-safe client projection returned by mobile employee client reads. */
export class EmployeeClientResponseDto {
  @ApiProperty({ example: '00000000-0000-4000-a000-000000000001' })
  id!: string;

  @ApiProperty({ example: 'Sara Al-Harbi' })
  name!: string;

  @ApiProperty({ type: String, example: 'Sara', nullable: true })
  firstName!: string | null;

  @ApiProperty({ type: String, example: 'Al-Harbi', nullable: true })
  lastName!: string | null;

  @ApiProperty({ type: String, example: '+966501234567', nullable: true })
  phone!: string | null;

  @ApiProperty({ type: String, example: 'sara@example.com', nullable: true })
  email!: string | null;

  @ApiProperty({ type: String, example: 'FEMALE', nullable: true })
  gender!: string | null;

  @ApiProperty({ description: 'Client date of birth in ISO 8601 format', type: String, format: 'date-time', example: '1990-06-15T00:00:00.000Z', nullable: true })
  dateOfBirth!: Date | null;

  @ApiProperty({ description: 'Client avatar URL', type: String, example: 'https://cdn.example.com/avatars/client-1.jpg', nullable: true })
  avatarUrl!: string | null;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ description: 'Timestamp when the client record was created', type: String, format: 'date-time', example: '2026-01-01T00:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ description: 'Timestamp when the client record was last updated', type: String, format: 'date-time', example: '2026-01-02T00:00:00.000Z' })
  updatedAt!: Date;
}
