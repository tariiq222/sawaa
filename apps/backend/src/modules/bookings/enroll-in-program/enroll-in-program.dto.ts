import { Type } from 'class-transformer';
import { BadRequestException } from '@nestjs/common';
import { IsArray, IsOptional, IsString, IsUUID, IsInt, Min, MinLength, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Shared command DTO accepted by the public self-enroll endpoint and the
 * dashboard on-behalf enrollment endpoint. Both surface the same handler,
 * which validates the program and books under a single transaction.
 *
 * `public` flips a few guards (isPublic must be true; clientId must come
 * from the verified session, never the body).
 */
export class EnrollInProgramDto {
  @ApiProperty({ format: 'uuid', description: 'Program to enroll into' })
  @IsUUID()
  programId!: string;

  @ApiProperty({ format: 'uuid', description: 'Client being enrolled' })
  @IsUUID()
  clientId!: string;
}

/**
 * Request body for the dashboard on-behalf enrollment endpoint. The program is
 * taken from the `:id` route param, so only the client is supplied in the body.
 */
export class EnrollClientDto {
  @ApiProperty({ format: 'uuid', description: 'Client being enrolled on-behalf' })
  @IsUUID()
  clientId!: string;
}

/**
 * Supervisor IDs are passed as a flat array; the slice handler resolves them
 * into the ProgramSupervisor composite-PK rows inside the create/update
 * transaction.
 */
export class ProgramSupervisorsDto {
  @ApiPropertyOptional({
    type: [String],
    description: 'Employee IDs that supervise this program',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  supervisorIds?: string[];
}

export class ScheduleProgramDto {
  @ApiProperty({ description: 'ISO date for the program start (must be future)' })
  @IsString()
  startDate!: string;

  @ApiPropertyOptional({ description: 'Override the duration in minutes (advisory)' })
  @IsOptional()
  durationMins?: number;
}

export class ProgramParticipantRefundDto {
  @ApiProperty({ format: 'uuid', description: 'Participant booking identifier from the current program cancellation preview', example: '11111111-1111-4111-8111-111111111111' })
  @IsUUID()
  bookingId!: string;

  @ApiProperty({ description: 'Additional refund in integer halalas', minimum: 0 })
  @IsInt()
  @Min(0)
  amount!: number;
}

export class CancelProgramDto {
  @ApiProperty({ description: 'Reason for cancelling the program' })
  @IsString()
  @MinLength(1)
  reason!: string;

  @ApiProperty({ description: 'Token from the current cancellation preview' })
  @IsString()
  @MinLength(1)
  quoteToken!: string;

  @ApiPropertyOptional({ type: [ProgramParticipantRefundDto], description: 'After program start, additional refunds in integer halalas for every paid participant, including explicit zero amounts; each amount must not exceed its preview maximum. Omit or send an empty list before start, when the full available balance is selected automatically.', example: [{ bookingId: '11111111-1111-4111-8111-111111111111', amount: 20000 }] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProgramParticipantRefundDto)
  refunds?: ProgramParticipantRefundDto[];
}

/**
 * Throws BadRequestException with the canonical message when a guard fails.
 * Centralised so both controllers and tests share the same string.
 */
export function rejectEnrollment(message: string): never {
  throw new BadRequestException(message);
}
