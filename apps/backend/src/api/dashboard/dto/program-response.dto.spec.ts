import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import {
  ProgramListItemResponseDto,
  ProgramPublishResponseDto,
  ProgramScheduleResponseDto,
  ProgramWriteResponseDto,
} from './program-response.dto';
import { ProgramDetailResponseDto } from './program-detail-response.dto';
import {
  ProgramCancellationPreviewDto,
  ProgramCancellationResultDto,
} from '../../../modules/bookings/cancel-program/program-cancellation.dto';
import type { CreateProgramHandler } from '../../../modules/bookings/create-program/create-program.handler';
import type { UpdateProgramHandler } from '../../../modules/bookings/update-program/update-program.handler';
import type { ListProgramsHandler } from '../../../modules/bookings/list-programs/list-programs.handler';
import type { GetProgramHandler } from '../../../modules/bookings/get-program/get-program.handler';
import type { PublishProgramHandler } from '../../../modules/bookings/publish-program/publish-program.handler';
import type { ScheduleProgramHandler } from '../../../modules/bookings/schedule-program/schedule-program.handler';
import type { CancelProgramHandler } from '../../../modules/bookings/cancel-program/cancel-program.handler';

// ── Compile-time exactness: DTO <=> INFERRED handler output ─────────────────
//
// No handler under src/modules is annotated with a return type and none imports
// from this layer. Every assertion below reads the handler's INFERRED return
// type, so it proves BOTH that the DTO covers what the handler really produces
// and that it documents nothing extra. The controller's `Promise<Dto>`
// annotation only proves the one-way assignability that these checks imply.

type Expect<T extends true> = T;
type Result<T, M extends keyof T> = T[M] extends (...args: never[]) => Promise<infer R> ? R : never;

/**
 * Structural equality. DTO fields are typed as classes while handlers return
 * object literals, so identity comparison is useless here: `Norm` flattens every
 * object and array element first, then `Extends` checks assignability in BOTH
 * directions. Optionality survives because `Norm` keeps a lone `undefined` in
 * the property type, so `required` vs `optional` is still a mismatch.
 * Seven negative controls below prove the helper is not vacuous.
 */
type Prim = string | number | boolean | bigint | symbol | null | undefined | Date;
type IsAny<T> = 0 extends 1 & T ? true : false;
type Norm<T> = IsAny<T> extends true ? T
  : T extends unknown
    ? T extends Prim ? T
    : T extends readonly (infer E)[] ? Norm<E>[]
    : T extends (...a: never[]) => unknown ? T
    : { [K in keyof T]: Norm<T[K]> }
  : never;
type Extends<A, B> = [A] extends [B] ? true : false;
type Equal<A, B> = Extends<Norm<A>, Norm<B>> extends true
  ? Extends<Norm<B>, Norm<A>>
  : false;

// ── Every in-scope route, against its INFERRED handler type ────────────────

export type CreateProgramMatches = Expect<Equal<Result<CreateProgramHandler, 'execute'>, ProgramWriteResponseDto>>;
export type UpdateProgramMatches = Expect<Equal<Result<UpdateProgramHandler, 'execute'>, ProgramWriteResponseDto>>;
/** The list route answers a bare array; there is no pagination wrapper. */
export type ListProgramsMatches = Expect<
  Equal<Result<ListProgramsHandler, 'execute'>, ProgramListItemResponseDto[]>
>;
export type GetProgramMatches = Expect<Equal<Result<GetProgramHandler, 'execute'>, ProgramDetailResponseDto>>;
export type PublishProgramMatches = Expect<Equal<Result<PublishProgramHandler, 'execute'>, ProgramPublishResponseDto>>;
export type ScheduleProgramMatches = Expect<Equal<Result<ScheduleProgramHandler, 'execute'>, ProgramScheduleResponseDto>>;

/**
 * `CancelProgramHandler.execute` is annotated with the module-side
 * `ProgramCancellationResult` interface, so `Result<>` only re-reads that
 * annotation instead of inferring a fresh one. The shape is therefore compared
 * through `DtoWithNarrowRefundStatus`, a copy of the DTO whose single widened
 * field is narrowed back to the interface's literal union.
 *
 * The one deliberate difference, reported rather than silently accepted: the
 * interface (and the runtime) narrow `participants[].refundStatus` to
 * `'PENDING_REVIEW' | 'PROCESSING' | 'NO_REFUND'`, while
 * `ProgramCancellationResultDto` declares the property as `string` and carries
 * the enum only in its `@ApiProperty`. The three assertions below pin the whole
 * delta: everything else is exact, the DTO documents the enum, and the only
 * type-level gap is that `string`. `program-cancellation.dto.ts` is outside this
 * unit's scope, so narrowing the class property is a type-only follow-up.
 */
type NarrowRefundStatus = 'PENDING_REVIEW' | 'PROCESSING' | 'NO_REFUND';
type DtoWithNarrowRefundStatus = Omit<ProgramCancellationResultDto, 'participants'> & {
  participants: Array<
    Omit<ProgramCancellationResultDto['participants'][number], 'refundStatus'> & {
      refundStatus: NarrowRefundStatus;
    }
  >;
};
export type CancelProgramMatches = Expect<
  Equal<Result<CancelProgramHandler, 'execute'>, DtoWithNarrowRefundStatus>
>;
export type CancelProgramDtoIsTheHandlerShapeWithOnlyAWiderRefundStatus = Expect<
  Equal<Result<CancelProgramHandler, 'execute'>['participants'][number]['refundStatus'], NarrowRefundStatus> extends true
    ? Equal<ProgramCancellationResultDto['participants'][number]['refundStatus'], string>
    : false
>;
/** Preview is an inferred return type, so this one is exact in both directions. */
export type CancellationPreviewMatches = Expect<
  Equal<Result<CancelProgramHandler, 'preview'>, ProgramCancellationPreviewDto>
>;

// ── Negative controls: the equality helper is not vacuous ───────────────────

type ListRow = Result<ListProgramsHandler, 'execute'>[number];
type N_extraKey = Equal<ListRow, ProgramListItemResponseDto & { extra: 1 }>;
type N_missingKey = Equal<ListRow, Omit<ProgramListItemResponseDto, 'enrollmentCount'>>;
type N_changedType = Equal<ListRow, Omit<ProgramListItemResponseDto, 'price'> & { price: number }>;
type N_optionality = Equal<ListRow, Omit<ProgramListItemResponseDto, 'isFull'> & { isFull?: boolean }>;
/** Nested: an array element field changed two levels down. */
type N_nestedType = Equal<
  ListRow,
  Omit<ProgramListItemResponseDto, 'supervisorIds'> & { supervisorIds: string }
>;
/** A narrower nested element is not interchangeable with the wider one. */
type N_nestedNarrowing = Equal<
  Result<GetProgramHandler, 'execute'>,
  Omit<ProgramDetailResponseDto, 'status'> & { status: 'OPEN' }
>;
/** Two routes with different payloads are not interchangeable. */
type N_wrongRoute = Equal<Result<CreateProgramHandler, 'execute'>, ProgramListItemResponseDto>;
export type ControlsReject = Expect<
  [N_extraKey, N_missingKey, N_changedType, N_optionality, N_nestedType, N_nestedNarrowing, N_wrongRoute] extends
    [false, false, false, false, false, false, false] ? true : false
>;

// ── Schema-level shape assertions ──────────────────────────────────────────

async function buildSchemas(): Promise<Record<string, SchemaObject>> {
  const moduleRef = await Test.createTestingModule({}).compile();
  const app = moduleRef.createNestApplication();
  try {
    const document = SwaggerModule.createDocument(app, new DocumentBuilder().build(), {
      extraModels: [
        ProgramListItemResponseDto,
        ProgramWriteResponseDto,
        ProgramPublishResponseDto,
        ProgramScheduleResponseDto,
        ProgramDetailResponseDto,
        ProgramCancellationPreviewDto,
        ProgramCancellationResultDto,
      ],
    });
    return (document.components?.schemas ?? {}) as Record<string, SchemaObject>;
  } finally {
    await app.close();
  }
}

describe('program response schemas (output shape)', () => {
  it('documents every field the list handler maps, and only those', async () => {
    const schema = (await buildSchemas()).ProgramListItemResponseDto;
    expect([...(schema.required ?? [])].sort()).toEqual(
      [
        'id', 'ref', 'nameAr', 'nameEn', 'departmentId', 'branchId', 'startDate', 'daysCount',
        'hoursPerDay', 'minParticipants', 'maxParticipants', 'enrolledCount', 'price', 'currency',
        'depositEnabled', 'depositAmount', 'status', 'isPublic', 'cancelledAt', 'createdAt',
        'supervisorIds', 'isFull', 'enrollmentCount',
      ].sort(),
    );
    for (const key of [
      'ref', 'daysCount', 'hoursPerDay', 'minParticipants', 'maxParticipants', 'enrolledCount', 'enrollmentCount',
    ]) {
      expect(schema.properties?.[key]).toMatchObject({ type: 'integer' });
    }
  });

  it('keeps Prisma Decimal money as a decimal string, never a number', async () => {
    const schemas = await buildSchemas();
    expect(schemas.ProgramListItemResponseDto.properties?.price).toMatchObject({ type: 'string' });
    expect(schemas.ProgramListItemResponseDto.properties?.depositAmount).toMatchObject({
      type: 'string',
      nullable: true,
    });
  });

  it('documents the write response as identity + state + supervisors only', async () => {
    const schema = (await buildSchemas()).ProgramWriteResponseDto;
    expect([...(schema.required ?? [])].sort()).toEqual(['id', 'ref', 'status', 'supervisorIds'].sort());
    expect(schema.properties?.status).toMatchObject({
      enum: ['DRAFT', 'OPEN', 'MIN_REACHED', 'SCHEDULED', 'COMPLETED', 'CANCELLED'],
    });
    expect(schema.properties?.supervisorIds).toMatchObject({ type: 'array', items: { type: 'string' } });
  });

  it('documents publish and schedule payloads with their status enum', async () => {
    const schemas = await buildSchemas();
    expect([...(schemas.ProgramPublishResponseDto.required ?? [])].sort()).toEqual(['id', 'status'].sort());
    expect(schemas.ProgramPublishResponseDto.properties?.status).toMatchObject({
      enum: ['DRAFT', 'OPEN', 'MIN_REACHED', 'SCHEDULED', 'COMPLETED', 'CANCELLED'],
    });
    expect(schemas.ProgramScheduleResponseDto.properties?.startDate).toMatchObject({
      type: 'string',
      format: 'date-time',
    });
    expect([...(schemas.ProgramScheduleResponseDto.required ?? [])].sort()).toEqual(
      ['id', 'status', 'startDate'].sort(),
    );
  });

  it('leaves the pre-existing detail schema untouched', async () => {
    const schema = (await buildSchemas()).ProgramDetailResponseDto;
    expect([...(schema.required ?? [])].sort()).toEqual(
      [
        'id', 'ref', 'departmentId', 'branchId', 'nameAr', 'nameEn', 'descriptionAr', 'descriptionEn',
        'startDate', 'daysCount', 'hoursPerDay', 'minParticipants', 'maxParticipants', 'enrolledCount',
        'price', 'currency', 'depositEnabled', 'depositAmount', 'status', 'isPublic',
        'publicDescriptionAr', 'publicDescriptionEn', 'cancelReason', 'cancelledAt', 'createdAt',
        'updatedAt', 'supervisorIds', 'supervisors', 'isFull', 'enrollments',
      ].sort(),
    );
    expect(schema.properties?.supervisors).toMatchObject({
      type: 'array',
      items: { $ref: '#/components/schemas/ProgramSupervisorResponseDto' },
    });
    expect(schema.properties?.enrollments).toMatchObject({
      type: 'array',
      items: { $ref: '#/components/schemas/ProgramEnrollmentResponseDto' },
    });
  });

  it('keeps the cancellation schemas exact and documents every refund status', async () => {
    const schemas = await buildSchemas();
    expect([...(schemas.ProgramCancellationPreviewDto.required ?? [])].sort()).toEqual(
      ['programId', 'hasStarted', 'quoteToken', 'participants'].sort(),
    );
    expect([...(schemas.ProgramCancellationParticipantDto.required ?? [])].sort()).toEqual(
      [
        'bookingId', 'clientId', 'clientName', 'bookingNumber', 'status', 'currency',
        'paidAmount', 'alreadyRefundedAmount', 'pendingRefundAmount', 'maxRefundAmount', 'refundAmount',
      ].sort(),
    );
    expect([...(schemas.ProgramCancellationResultDto.required ?? [])].sort()).toEqual(
      ['id', 'status', 'cancelledEnrollments', 'skippedEnrollments', 'participants'].sort(),
    );
    const participantResult = schemas.ProgramCancellationParticipantResultDto;
    expect([...(participantResult.required ?? [])].sort()).toEqual(
      ['bookingId', 'refundAmount', 'currency', 'refundStatus'].sort(),
    );
    // The enum is the only place the narrowed vocabulary survives on the DTO.
    expect(participantResult.properties?.refundStatus).toMatchObject({
      type: 'string',
      enum: ['PENDING_REVIEW', 'PROCESSING', 'NO_REFUND'],
    });
  });
});
