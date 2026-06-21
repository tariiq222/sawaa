import { BadRequestException } from '@nestjs/common';
import { IsArray, IsOptional, IsString, IsUUID } from 'class-validator';
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

export class CancelProgramDto {
  @ApiProperty({ description: 'Reason for cancelling the program' })
  @IsString()
  reason!: string;
}

/**
 * Throws BadRequestException with the canonical message when a guard fails.
 * Centralised so both controllers and tests share the same string.
 */
export function rejectEnrollment(message: string): never {
  throw new BadRequestException(message);
}
