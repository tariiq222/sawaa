import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import {
  EmployeeAssignedServiceDto,
  EmployeeAvailabilityExceptionRecordDto,
  EmployeeAvailabilityUpdateResponseDto,
  EmployeeAvailabilityWindowRecordDto,
  EmployeeBreakRecordDto,
  EmployeeBreaksResponseDto,
  EmployeeCustomPricingResponseDto,
  EmployeeDeliveryTypesResponseDto,
  EmployeeDetailResponseDto,
  EmployeeEffectiveDurationGroupDto,
  EmployeeOnboardResponseDto,
  EmployeePricingModeResponseDto,
  EmployeeRatingRecordDto,
  EmployeeRatingsResponseDto,
  EmployeeScheduleResponseDto,
  EmployeeServiceOptionRecordDto,
  EmployeeServiceRecordDto,
  EmployeeServiceTypeDto,
  EmployeeSlotDto,
  EmployeeWriteResponseDto,
  ServiceDurationOptionRecordDto,
  ServiceRecordDto,
} from './employee-response.dto';
import {
  EmployeeResponseDto,
  EmployeeStatsResponseDto,
  PaginatedEmployeesDto,
  UploadAvatarResponseDto,
} from './people-response.dto';
import type {
  EmployeeAvailability,
  EmployeeAvailabilityException,
  EmployeeBreak,
  EmployeeService,
  EmployeeServiceOption,
  Prisma,
  Rating,
  Service,
  ServiceDurationOption,
} from '@prisma/client';
import { mapEmployeeRow } from '../../../modules/people/employees/employee-row.mapper';
import type { ListEmployeesHandler } from '../../../modules/people/employees/list-employees.handler';
import type { CreateEmployeeHandler } from '../../../modules/people/employees/create-employee.handler';
import type { OnboardEmployeeHandler } from '../../../modules/people/employees/onboard-employee.handler';
import type { GetEmployeeHandler } from '../../../modules/people/employees/get-employee.handler';
import type { UpdateEmployeeHandler } from '../../../modules/people/employees/update-employee.handler';
import type { EmployeeOnboardingHandler } from '../../../modules/people/employees/employee-onboarding.handler';
import type { EmployeeStatsHandler } from '../../../modules/people/employees/employee-stats.handler';
import type { EmployeeAvailabilityQueryHandler } from '../../../modules/bookings/employee-availability-query.handler';
import type { GetAvailabilityHandler } from '../../../modules/people/employees/get-availability.handler';
import type { UpdateAvailabilityHandler } from '../../../modules/people/employees/update-availability.handler';
import type { GetEmployeeBreaksHandler } from '../../../modules/people/employees/get-employee-breaks/get-employee-breaks.handler';
import type { SetEmployeeBreaksHandler } from '../../../modules/people/employees/set-employee-breaks/set-employee-breaks.handler';
import type { ListEmployeeExceptionsHandler } from '../../../modules/people/employees/list-employee-exceptions.handler';
import type { CreateEmployeeExceptionHandler } from '../../../modules/people/employees/create-employee-exception.handler';
import type { ListEmployeeServicesHandler } from '../../../modules/people/employees/list-employee-services.handler';
import type { AssignEmployeeServiceHandler } from '../../../modules/people/employees/assign-employee-service.handler';
import type { UpdateEmployeeServiceHandler } from '../../../modules/people/employees/update-employee-service.handler';
import type { SetEmployeeServiceOptionsHandler } from '../../../modules/org-experience/services/set-employee-service-options.handler';
import type { SetEmployeeDeliveryTypesHandler } from '../../../modules/org-experience/services/set-employee-delivery-types/set-employee-delivery-types.handler';
import type { SetEmployeePricingModeHandler } from '../../../modules/org-experience/services/set-employee-pricing-mode/set-employee-pricing-mode.handler';
import type { ListEmployeeRatingsHandler } from '../../../modules/people/employees/list-employee-ratings.handler';
import type { UploadAvatarHandler } from '../../../modules/people/employees/upload-avatar/upload-avatar.handler';
import type { GetEmployeeServiceTypesHandler } from '../../../modules/people/employees/get-employee-service-types.handler';
import type { SetEmployeeCustomPricingHandler } from '../../../modules/org-experience/services/set-employee-custom-pricing/set-employee-custom-pricing.handler';
import type { SetEmployeeDurationsHandler } from '../../../modules/org-experience/services/set-employee-durations/set-employee-durations.handler';


// ── Compile-time exactness: DTO <=> handler output ──────────────────────────
//
// Controller return types prove assignability in one direction (the handler
// fits the DTO). They cannot prove the DTO does not document a key the handler
// never produces. These assertions check both directions, and they reference
// the mapper and Prisma payload types rather than hand-written fixtures, so a
// new/renamed/retyped handler field becomes a type error here.

type Expect<T extends true> = T;
/**
 * Mutual assignability. Interface/array widening means structural identity is
 * not preserved for every alias, but a genuine field/TYPE change still breaks
 * one of the two directions.
 */
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

type MappedEmployee = ReturnType<typeof mapEmployeeRow>;
type EmployeeWritePayload = Prisma.EmployeeGetPayload<{
  include: { branches: true; services: true };
}>;

export type ReadProjectionMatchesDto = Expect<Equal<MappedEmployee, EmployeeResponseDto>>;
export type WritePayloadMatchesDto = Expect<Equal<EmployeeWritePayload, EmployeeWriteResponseDto>>;

// Raw Prisma rows returned directly by the handlers.
export type WindowRecordMatchesPrisma = Expect<
  Equal<EmployeeAvailabilityWindowRecordDto, EmployeeAvailability>
>;
export type ExceptionRecordMatchesPrisma = Expect<
  Equal<EmployeeAvailabilityExceptionRecordDto, EmployeeAvailabilityException>
>;
export type BreakRecordMatchesPrisma = Expect<Equal<EmployeeBreakRecordDto, EmployeeBreak>>;
export type ServiceLinkRecordMatchesPrisma = Expect<Equal<EmployeeServiceRecordDto, EmployeeService>>;
export type ServiceRecordMatchesPrisma = Expect<Equal<ServiceRecordDto, Service>>;
export type DurationOptionRecordMatchesPrisma = Expect<
  Equal<ServiceDurationOptionRecordDto, ServiceDurationOption>
>;
export type ServiceOptionRecordMatchesPrisma = Expect<
  Equal<EmployeeServiceOptionRecordDto, EmployeeServiceOption & { durationOption: ServiceDurationOption }>
>;
export type RatingRecordMatchesPrisma = Expect<Equal<EmployeeRatingRecordDto, Rating>>;

// Shapes the handlers derive from those rows (rather than return verbatim).
type ServiceTypeResult = Awaited<ReturnType<GetEmployeeServiceTypesHandler['execute']>>;
export type ServiceTypeMatchesHandler = Expect<Equal<ServiceTypeResult, EmployeeServiceTypeDto[]>>;
type CustomPricingResult = Awaited<ReturnType<SetEmployeeCustomPricingHandler['execute']>>;
export type CustomPricingMatchesHandler = Expect<Equal<CustomPricingResult, EmployeeCustomPricingResponseDto>>;
type EffectiveDurationsResult = Awaited<ReturnType<SetEmployeeDurationsHandler['execute']>>;
export type EffectiveDurationsMatchesHandler = Expect<
  Equal<EffectiveDurationsResult, EmployeeEffectiveDurationGroupDto[]>
>;

/**
 * Every in-scope controller method, checked directly against its handler.
 * These are the assertions the controller return types alone cannot make: a
 * DTO that documents a key the handler never emits still assigns cleanly
 * one-way, but fails here.
 */
type Result<T, M extends keyof T> = T[M] extends (...args: never[]) => Promise<infer R> ? R : never;

export type ListEmployeesMatches = Expect<Equal<Result<ListEmployeesHandler, 'execute'>, PaginatedEmployeesDto>>;
export type CreateEmployeeMatches = Expect<Equal<Result<CreateEmployeeHandler, 'execute'>, EmployeeWriteResponseDto>>;
export type OnboardEmployeeMatches = Expect<Equal<Result<OnboardEmployeeHandler, 'execute'>, EmployeeOnboardResponseDto>>;
export type GetEmployeeMatches = Expect<Equal<Result<GetEmployeeHandler, 'execute'>, EmployeeDetailResponseDto>>;
export type UpdateEmployeeMatches = Expect<Equal<Result<UpdateEmployeeHandler, 'execute'>, EmployeeWriteResponseDto>>;
export type OnboardingStepMatches = Expect<
  Equal<Result<EmployeeOnboardingHandler, 'execute'>, EmployeeWriteResponseDto | null>
>;
export type EmployeeStatsMatches = Expect<Equal<Result<EmployeeStatsHandler, 'execute'>, EmployeeStatsResponseDto>>;
export type SlotsMatches = Expect<Equal<Result<EmployeeAvailabilityQueryHandler, 'slots'>, EmployeeSlotDto[]>>;
export type AvailableDaysMatches = Expect<Equal<Result<EmployeeAvailabilityQueryHandler, 'availableDays'>, string[]>>;
export type GetAvailabilityMatches = Expect<Equal<Result<GetAvailabilityHandler, 'execute'>, EmployeeScheduleResponseDto>>;
export type UpdateAvailabilityMatches = Expect<
  Equal<Result<UpdateAvailabilityHandler, 'execute'>, EmployeeAvailabilityUpdateResponseDto>
>;
export type GetBreaksMatches = Expect<Equal<Result<GetEmployeeBreaksHandler, 'execute'>, EmployeeBreaksResponseDto>>;
export type SetBreaksMatches = Expect<Equal<Result<SetEmployeeBreaksHandler, 'execute'>, EmployeeBreaksResponseDto>>;
export type ListExceptionsMatches = Expect<
  Equal<Result<ListEmployeeExceptionsHandler, 'execute'>, EmployeeAvailabilityExceptionRecordDto[]>
>;
export type CreateExceptionMatches = Expect<
  Equal<Result<CreateEmployeeExceptionHandler, 'execute'>, EmployeeAvailabilityExceptionRecordDto>
>;
export type ListServicesMatches = Expect<
  Equal<Result<ListEmployeeServicesHandler, 'execute'>, EmployeeAssignedServiceDto[]>
>;
export type AssignServiceMatches = Expect<Equal<Result<AssignEmployeeServiceHandler, 'execute'>, EmployeeServiceRecordDto>>;
export type UpdateServiceMatches = Expect<Equal<Result<UpdateEmployeeServiceHandler, 'execute'>, EmployeeServiceRecordDto>>;
export type ServiceOptionsMatches = Expect<
  Equal<Result<SetEmployeeServiceOptionsHandler, 'execute'>, EmployeeServiceOptionRecordDto[]>
>;
export type DeliveryTypesMatches = Expect<
  Equal<Result<SetEmployeeDeliveryTypesHandler, 'execute'>, EmployeeDeliveryTypesResponseDto>
>;
export type PricingModeMatches = Expect<
  Equal<Result<SetEmployeePricingModeHandler, 'execute'>, EmployeePricingModeResponseDto>
>;
export type RatingsMatches = Expect<Equal<Result<ListEmployeeRatingsHandler, 'execute'>, EmployeeRatingsResponseDto>>;
export type UploadAvatarMatches = Expect<Equal<Result<UploadAvatarHandler, 'execute'>, UploadAvatarResponseDto>>;

async function buildSchemas(): Promise<Record<string, SchemaObject>> {
  const moduleRef = await Test.createTestingModule({}).compile();
  const app = moduleRef.createNestApplication();
  try {
    const document = SwaggerModule.createDocument(app, new DocumentBuilder().build(), {
      extraModels: [
        EmployeeResponseDto,
        EmployeeDetailResponseDto,
        EmployeeWriteResponseDto,
        EmployeeOnboardResponseDto,
        PaginatedEmployeesDto,
        EmployeeScheduleResponseDto,
        EmployeeAvailabilityUpdateResponseDto,
        EmployeeBreaksResponseDto,
        EmployeeAvailabilityExceptionRecordDto,
        EmployeeBreakRecordDto,
        EmployeeSlotDto,
        EmployeeServiceRecordDto,
        EmployeeServiceOptionRecordDto,
        EmployeeServiceTypeDto,
        EmployeeCustomPricingResponseDto,
        EmployeeEffectiveDurationGroupDto,
        EmployeeRatingsResponseDto,
      ],
    });
    return (document.components?.schemas ?? {}) as Record<string, SchemaObject>;
  } finally {
    await app.close();
  }
}

describe('employee response schemas (output shape)', () => {
  it('EmployeeResponseDto documents every mapped-employee key as required', async () => {
    const schema = (await buildSchemas()).EmployeeResponseDto;
    expect(schema).toBeDefined();
    expect([...(schema.required ?? [])].sort()).toEqual(
      [
        'averageRating', 'availability', 'avatarUrl', 'bio', 'bioAr', 'bookingCount',
        'branchIds', 'createdAt', 'education', 'educationAr', 'email', 'employmentType',
        'experience', 'gender', 'id', 'isAcceptingBookings', 'isActive', 'isPublic',
        'name', 'nameAr', 'nameEn', 'onboardingStatus', 'phone', 'publicBioAr',
        'publicBioEn', 'publicImageUrl', 'ratingCount', 'ref', 'serviceIds', 'slug',
        'specialty', 'specialtyAr', 'title', 'updatedAt', 'userId',
      ].sort(),
    );
    expect(schema.properties?.gender).toMatchObject({ type: 'string', enum: ['MALE', 'FEMALE'], nullable: true });
    expect(schema.properties?.availability).toMatchObject({ type: 'array' });
  });

  it('EmployeeDetailResponseDto is the read projection plus exceptions', async () => {
    const schema = (await buildSchemas()).EmployeeDetailResponseDto;
    expect([...(schema.required ?? [])].sort()).toEqual(
      [...Object.keys((await buildSchemas()).EmployeeResponseDto.properties ?? {}), 'exceptions'].sort(),
    );
  });

  it('the paginated wrapper documents its item and meta members', async () => {
    const schema = (await buildSchemas()).PaginatedEmployeesDto;
    expect(schema.properties?.items).toMatchObject({
      type: 'array',
      items: { $ref: '#/components/schemas/EmployeeResponseDto' },
    });
    // A described @ApiProperty wraps the $ref in `allOf`.
    expect(schema.properties?.meta).toMatchObject({
      allOf: [{ $ref: '#/components/schemas/ListMetaDto' }],
    });
  });

  it('the schedule and break wrappers document their arrays', async () => {
    const schemas = await buildSchemas();
    expect(schemas.EmployeeScheduleResponseDto.properties?.schedule).toMatchObject({
      type: 'array',
      items: { $ref: '#/components/schemas/EmployeeAvailabilityWindowRecordDto' },
    });
    expect(schemas.EmployeeScheduleResponseDto.properties?.exceptions).toMatchObject({
      type: 'array',
      items: { $ref: '#/components/schemas/EmployeeAvailabilityExceptionRecordDto' },
    });
    expect(schemas.EmployeeBreaksResponseDto.properties?.breaks).toMatchObject({
      type: 'array',
      items: { $ref: '#/components/schemas/EmployeeBreakRecordDto' },
    });
  });
});
