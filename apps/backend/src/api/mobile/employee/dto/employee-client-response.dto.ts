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

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  dateOfBirth!: Date | null;

  @ApiProperty({ type: String, nullable: true })
  avatarUrl!: string | null;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;
}
