import { ApiProperty } from '@nestjs/swagger';
import { IntakeFieldType, IntakeFormScope, IntakeFormType } from '@prisma/client';

const LOWERCASE_FORM_TYPES = ['pre_booking', 'pre_session', 'post_session', 'registration'];
const LOWERCASE_FORM_SCOPES = ['global', 'service', 'employee', 'branch'];

export class IntakeFieldResponseDto {
  @ApiProperty({ description: 'Field UUID', format: 'uuid' })
  id!: string;

  @ApiProperty({ description: 'Parent form UUID', format: 'uuid' })
  formId!: string;

  @ApiProperty({ description: 'Arabic field label' })
  labelAr!: string;

  @ApiProperty({ description: 'English field label', type: String, nullable: true })
  labelEn!: string | null;

  @ApiProperty({ description: 'Field input type', enum: IntakeFieldType })
  fieldType!: IntakeFieldType;

  @ApiProperty({ description: 'Whether an answer is required' })
  isRequired!: boolean;

  @ApiProperty({ description: 'Options for selectable fields', type: [String], nullable: true })
  options!: string[] | null;

  @ApiProperty({ description: 'Display order, zero-based' })
  position!: number;

  @ApiProperty({ description: 'Creation timestamp', type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ description: 'Last update timestamp', type: String, format: 'date-time' })
  updatedAt!: Date;
}

export class IntakeFormResponseDto {
  @ApiProperty({ description: 'Form UUID', format: 'uuid' })
  id!: string;

  @ApiProperty({ description: 'Human-readable form reference', example: 1024 })
  ref!: number;

  @ApiProperty({ description: 'Arabic form name' })
  nameAr!: string;

  @ApiProperty({ description: 'English form name', type: String, nullable: true })
  nameEn!: string | null;

  @ApiProperty({ description: 'Form type', enum: IntakeFormType })
  type!: IntakeFormType;

  @ApiProperty({ description: 'Form scope', enum: IntakeFormScope })
  scope!: IntakeFormScope;

  @ApiProperty({ description: 'Scoped service, employee, or branch UUID', type: String, nullable: true })
  scopeId!: string | null;

  @ApiProperty({ description: 'Whether the form is active' })
  isActive!: boolean;

  @ApiProperty({ description: 'Creation timestamp', type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ description: 'Last update timestamp', type: String, format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ description: 'Ordered form fields', type: [IntakeFieldResponseDto] })
  fields!: IntakeFieldResponseDto[];

  @ApiProperty({ description: 'Number of stored submissions', minimum: 0, example: 3 })
  submissionsCount!: number;
}

export class IntakeFormListItemResponseDto {
  @ApiProperty({ description: 'Form UUID', format: 'uuid' })
  id!: string;

  @ApiProperty({ description: 'Human-readable form reference', example: 1024 })
  ref!: number;

  @ApiProperty({ description: 'Arabic form name' })
  nameAr!: string;

  @ApiProperty({ description: 'English form name', type: String, nullable: true })
  nameEn!: string | null;

  @ApiProperty({ description: 'Lowercase form type for list clients', enum: LOWERCASE_FORM_TYPES, example: 'pre_session' })
  type!: string;

  @ApiProperty({ description: 'Lowercase form scope for list clients', enum: LOWERCASE_FORM_SCOPES, example: 'service' })
  scope!: string;

  @ApiProperty({ description: 'Scoped service, employee, or branch UUID', type: String, nullable: true })
  scopeId!: string | null;

  @ApiProperty({ description: 'Whether the form is active' })
  isActive!: boolean;

  @ApiProperty({ description: 'Creation timestamp', type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ description: 'Last update timestamp', type: String, format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ description: 'Ordered form fields', type: [IntakeFieldResponseDto] })
  fields!: IntakeFieldResponseDto[];

  @ApiProperty({ description: 'Number of stored submissions', minimum: 0, example: 3 })
  submissionsCount!: number;

  @ApiProperty({ description: 'Number of configured fields', minimum: 0, example: 4 })
  fieldsCount!: number;

  @ApiProperty({ description: 'Resolved scope target label', type: String, nullable: true })
  scopeLabel!: string | null;
}

export class IntakeFormBookingResponseDto extends IntakeFormListItemResponseDto {
  @ApiProperty({ description: 'Resolved service UUID', format: 'uuid', type: String, nullable: true })
  serviceId!: string | null;

  @ApiProperty({ description: 'Resolved employee UUID', format: 'uuid', type: String, nullable: true })
  employeeId!: string | null;

  @ApiProperty({ description: 'Resolved branch UUID', format: 'uuid', type: String, nullable: true })
  branchId!: string | null;
}

export class IntakeBookingResponseDto {
  @ApiProperty({ description: 'Response UUID', format: 'uuid' })
  id!: string;

  @ApiProperty({ description: 'Form UUID', format: 'uuid' })
  formId!: string;

  @ApiProperty({ description: 'Booking UUID', format: 'uuid' })
  bookingId!: string;

  @ApiProperty({ description: 'Client UUID normalized for booking-response reads', example: '' })
  clientId!: string;

  @ApiProperty({
    description: 'Answers keyed by field UUID',
    type: 'object',
    additionalProperties: { oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] },
  })
  answers!: Record<string, string | string[]>;

  @ApiProperty({ description: 'Submission timestamp', type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ description: 'Form summary and resolved scope identifiers', type: IntakeFormBookingResponseDto })
  form!: IntakeFormBookingResponseDto;
}

export class IntakeSubmissionResponseDto {
  @ApiProperty({ description: 'Response UUID', format: 'uuid' })
  id!: string;

  @ApiProperty({ description: 'Form UUID', format: 'uuid' })
  formId!: string;

  @ApiProperty({ description: 'Booking UUID', format: 'uuid' })
  bookingId!: string;

  @ApiProperty({ description: 'Client UUID', format: 'uuid', type: String, nullable: true })
  clientId!: string | null;

  @ApiProperty({
    description: 'Answers keyed by field UUID',
    type: 'object',
    additionalProperties: { oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] },
  })
  answers!: Record<string, string | string[]>;

  @ApiProperty({ description: 'Submission timestamp', type: String, format: 'date-time' })
  createdAt!: Date;
}
