import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';

import { CatalogServiceDto, PublicCatalogDto } from './catalog-response.dto';
import {
  PublicBranchDetailDto,
  PublicBranchEmployeeDto,
  PublicBranchListItemDto,
} from './branch-response.dto';
import { PublicAvailabilityDayDto, PublicAvailabilitySlotDto } from './availability-response.dto';
import { PublicEmployeeProfileDto } from './employee-response.dto';
import { PublicTestimonialResponseDto } from './testimonial-response.dto';
import { PublicPractitionerBookingOptionsDto } from './practitioner-booking-options-response.dto';
import {
  PublicPackageFamilyWithVatResponseDto,
  PublicPackageResponseDto,
} from './package-response.dto';
import {
  PublicProgramDetailResponseDto,
  PublicProgramListItemDto,
  PublicProgramsListResponseDto,
} from './program-response.dto';

import type { GetPublicBranchesHandler } from '../../modules/org-config/branches/public/get-public-branches.handler';
import type { GetPublicBranchHandler } from '../../modules/org-config/branches/public/get-public-branch.handler';
import type { ListPublicBranchEmployeesHandler } from '../../modules/org-config/branches/public/list-public-branch-employees.handler';
import type { ListPublicEmployeesHandler } from '../../modules/people/employees/public/list-public-employees.handler';
import type { GetPublicEmployeeHandler } from '../../modules/people/employees/public/get-public-employee.handler';
import type { GetPublicAvailabilityHandler } from '../../modules/bookings/availability/public/get-public-availability.handler';
import type { GetPublicAvailabilityDaysHandler } from '../../modules/bookings/availability/public/get-public-availability-days.handler';
import type { ListPublicTestimonialsHandler } from '../../modules/org-experience/ratings/list-public-testimonials.handler';
import type { ListPublicPackageFamiliesHandler } from '../../modules/org-experience/package-families/list-public-package-families/list-public-package-families.handler';
import type { GetPublicPackageFamilyHandler } from '../../modules/org-experience/package-families/get-public-package-family/get-public-package-family.handler';
import type { ListPublicPackagesHandler } from '../../modules/org-experience/session-packages/list-public-packages/list-public-packages.handler';
import type { GetPublicPackageHandler } from '../../modules/org-experience/session-packages/get-public-package/get-public-package.handler';
import type { ListPublicProgramsHandler } from '../../modules/bookings/public/list-public-programs.handler';
import type { GetPublicProgramHandler } from '../../modules/bookings/public/get-public-program.handler';
import type { GetPublicCatalogHandler } from '../../modules/org-experience/public-catalog/get-public-catalog.handler';
import type { GetPractitionerBookingOptionsHandler } from '../../modules/org-experience/services/get-practitioner-booking-options/get-practitioner-booking-options.handler';

import { GetPublicCatalogHandler as GetPublicCatalogHandlerClass } from '../../modules/org-experience/public-catalog/get-public-catalog.handler';
import { PrismaService } from '../../infrastructure/database';
import { CacheService } from '../../infrastructure/cache';
import { MinioService } from '../../infrastructure/storage/minio.service';
import { ConfigService } from '@nestjs/config';

// ── Compile-time exactness: DTO <=> INFERRED handler output ────────────────
//
// The controllers annotate `Promise<Dto>`, which only proves the handler fits
// the DTO. These assertions also prove the DTO documents nothing the handler
// never produces. Nothing under `src/modules` imports from this layer: every
// import above is `import type`, so the handlers stay INFERRED.

type Expect<T extends true> = T;
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
type Result<T, M extends keyof T> = T[M] extends (...args: never[]) => Promise<infer R> ? R : never;

// ── Every in-scope route, against its INFERRED handler type ────────────────

export type ListBranchesMatches = Expect<
  Equal<Result<GetPublicBranchesHandler, 'execute'>, PublicBranchListItemDto[]>
>;
export type GetBranchMatches = Expect<
  Equal<Result<GetPublicBranchHandler, 'execute'>, PublicBranchDetailDto>
>;
export type ListBranchEmployeesMatches = Expect<
  Equal<Result<ListPublicBranchEmployeesHandler, 'execute'>, PublicBranchEmployeeDto[]>
>;
export type ListEmployeesMatches = Expect<
  Equal<Result<ListPublicEmployeesHandler, 'execute'>, PublicEmployeeProfileDto[]>
>;
export type GetEmployeeMatches = Expect<
  Equal<Result<GetPublicEmployeeHandler, 'execute'>, PublicEmployeeProfileDto>
>;
export type GetAvailabilityMatches = Expect<
  Equal<Result<GetPublicAvailabilityHandler, 'execute'>, PublicAvailabilitySlotDto[]>
>;
export type GetAvailabilityDaysMatches = Expect<
  Equal<Result<GetPublicAvailabilityDaysHandler, 'execute'>, PublicAvailabilityDayDto[]>
>;
export type ListTestimonialsMatches = Expect<
  Equal<Result<ListPublicTestimonialsHandler, 'execute'>, PublicTestimonialResponseDto[]>
>;
export type ListPackageFamiliesMatches = Expect<
  Equal<Result<ListPublicPackageFamiliesHandler, 'execute'>, PublicPackageFamilyWithVatResponseDto[]>
>;
export type GetPackageFamilyMatches = Expect<
  Equal<Result<GetPublicPackageFamilyHandler, 'execute'>, PublicPackageFamilyWithVatResponseDto>
>;
export type ListPackagesMatches = Expect<
  Equal<Result<ListPublicPackagesHandler, 'execute'>, PublicPackageResponseDto[]>
>;
export type GetPackageMatches = Expect<
  Equal<Result<GetPublicPackageHandler, 'execute'>, PublicPackageResponseDto>
>;
/** The list route wraps its rows in `{ programs }`. */
export type ListProgramsMatches = Expect<
  Equal<Result<ListPublicProgramsHandler, 'execute'>, PublicProgramsListResponseDto['programs']>
>;
export type GetProgramMatches = Expect<
  Equal<Result<GetPublicProgramHandler, 'execute'>, PublicProgramDetailResponseDto>
>;
export type GetCatalogMatches = Expect<
  Equal<Result<GetPublicCatalogHandler, 'execute'>, PublicCatalogDto>
>;
export type GetPractitionerBookingOptionsMatches = Expect<
  Equal<Result<GetPractitionerBookingOptionsHandler, 'execute'>, PublicPractitionerBookingOptionsDto>
>;

// ── Negative controls: the equality helper is not vacuous ──────────────────

type EmployeeRow = Result<ListPublicEmployeesHandler, 'execute'>[number];
type N_extraKey = Equal<EmployeeRow, PublicEmployeeProfileDto & { extra: 1 }>;
type N_missingKey = Equal<EmployeeRow, Omit<PublicEmployeeProfileDto, 'user'>>;
type N_changedType = Equal<EmployeeRow, Omit<PublicEmployeeProfileDto, 'rating'> & { rating: string }>;
type N_optionality = Equal<EmployeeRow, Omit<PublicEmployeeProfileDto, 'reviewCount'> & { reviewCount?: number }>;
/** Nested: the synthetic user field changes two levels down. */
type N_nestedType = Equal<
  EmployeeRow,
  Omit<PublicEmployeeProfileDto, 'user'> & { user: Omit<PublicEmployeeProfileDto['user'], 'avatarUrl'> & { avatarUrl: string } }
>;
/** Two routes with different payloads are not interchangeable. */
type N_wrongRoute = Equal<Result<GetPublicEmployeeHandler, 'execute'>, PublicBranchDetailDto>;
/** Array element drift is caught (an extra key on the row, not on the array). */
type N_wrapper = Equal<
  Result<ListPublicProgramsHandler, 'execute'>,
  Array<PublicProgramListItemDto & { total: number }>
>;
export type ControlsReject = Expect<
  [N_extraKey, N_missingKey, N_changedType, N_optionality, N_nestedType, N_wrongRoute, N_wrapper] extends
    [false, false, false, false, false, false, false] ? true : false
>;

// ── Schema-level shape assertions ──────────────────────────────────────────

async function buildSchemas(): Promise<Record<string, SchemaObject>> {
  const moduleRef = await Test.createTestingModule({}).compile();
  const app = moduleRef.createNestApplication();
  try {
    const document = SwaggerModule.createDocument(app, new DocumentBuilder().build(), {
      extraModels: [
        PublicCatalogDto,
        PublicBranchListItemDto,
        PublicBranchDetailDto,
        PublicBranchEmployeeDto,
        PublicAvailabilitySlotDto,
        PublicAvailabilityDayDto,
        PublicEmployeeProfileDto,
        PublicTestimonialResponseDto,
        PublicPractitionerBookingOptionsDto,
        PublicPackageFamilyWithVatResponseDto,
        PublicPackageResponseDto,
        PublicProgramsListResponseDto,
        PublicProgramDetailResponseDto,
      ],
    });
    return (document.components?.schemas ?? {}) as Record<string, SchemaObject>;
  } finally {
    await app.close();
  }
}

describe('public catalog response schemas (output shape)', () => {
  it('documents the full catalog row the handler actually emits', async () => {
    const schemas = await buildSchemas();
    expect([...(schemas.PublicCatalogDto.required ?? [])].sort()).toEqual(
      ['categories', 'departments', 'services', 'vatRate'].sort(),
    );
    expect([...(schemas.CatalogDepartmentDto.required ?? [])].sort()).toEqual(
      [
        'createdAt', 'descriptionAr', 'descriptionEn', 'icon', 'id', 'isActive', 'isVisible',
        'nameAr', 'nameEn', 'sortOrder', 'updatedAt',
      ].sort(),
    );
    expect([...(schemas.CatalogCategoryDto.required ?? [])].sort()).toEqual(
      [
        'bookingMode', 'createdAt', 'departmentId', 'iconBgColor', 'iconName', 'id', 'imageUrl',
        'isActive', 'kind', 'nameAr', 'nameEn', 'ref', 'sortOrder', 'updatedAt',
      ].sort(),
    );
    expect(schemas.CatalogCategoryDto.properties?.bookingMode).toMatchObject({ enum: ['DIRECT', 'SERVICES'] });
    expect(schemas.CatalogCategoryDto.properties?.kind).toMatchObject({ enum: ['CLINIC', 'SERVICE_GROUP'] });
    // `isHidden` must stay optional: the default catalog omits the key entirely.
    expect(schemas.CatalogServiceDto.properties?.isHidden).toMatchObject({ type: 'boolean' });
    expect(schemas.CatalogServiceDto.required ?? []).not.toContain('isHidden');
  });

  it('keeps Decimal money as a decimal string, never a number', async () => {
    const schemas = await buildSchemas();
    for (const name of ['CatalogServiceDto', 'CatalogServiceDurationOptionDto', 'CatalogServiceBookingConfigDto']) {
      expect(schemas[name].properties?.price).toMatchObject({ type: 'string' });
    }
  });

  it('keeps integer fields as integers', async () => {
    const schemas = await buildSchemas();
    expect(schemas.CatalogDepartmentDto.properties?.sortOrder).toMatchObject({ type: 'integer' });
    expect(schemas.CatalogCategoryDto.properties?.ref).toMatchObject({ type: 'integer' });
    expect(schemas.CatalogServiceDto.properties?.durationMins).toMatchObject({ type: 'integer' });
    expect(schemas.PublicTestimonialResponseDto.properties?.rating).toMatchObject({ type: 'integer', minimum: 1, maximum: 5 });
    expect(schemas.PublicAvailabilityDayDto.properties?.hasSlots).toMatchObject({ type: 'boolean' });
  });

  it('documents the public employee profile with its synthetic user and legacy aliases', async () => {
    const schemas = await buildSchemas();
    expect([...(schemas.PublicEmployeeProfileDto.required ?? [])].sort()).toEqual(
      [
        'availableDaysOfWeek', 'branchIds', 'employmentType', 'experience', 'id', 'isAvailableToday',
        'isBookable', 'languages', 'rating', 'ratingCount', 'reviewCount', 'serviceIds', 'user',
      ].sort(),
    );
    expect(schemas.PublicEmployeeProfileDto.properties?.user).toMatchObject({
      allOf: [{ $ref: '#/components/schemas/PublicEmployeeSyntheticUserDto' }],
    });
    expect([...(schemas.PublicEmployeeSyntheticUserDto.required ?? [])].sort()).toEqual(
      ['avatarUrl', 'email', 'firstName', 'id', 'lastName', 'phone'].sort(),
    );
  });

  it('documents the branch detail as the list row plus location and hours', async () => {
    const schemas = await buildSchemas();
    const list = Object.keys(schemas.PublicBranchListItemDto.properties ?? {}).sort();
    const detail = Object.keys(schemas.PublicBranchDetailDto.properties ?? {}).sort();
    expect(detail.filter((key) => !list.includes(key)).sort()).toEqual(
      ['addressEn', 'businessHours', 'latitude', 'longitude', 'phone', 'timezone'].sort(),
    );
    expect(schemas.PublicBranchDetailDto.properties?.businessHours).toMatchObject({
      type: 'array',
      items: { $ref: '#/components/schemas/PublicBusinessHourDto' },
    });
  });

  it('documents availability slots as ISO timestamps and days as a boolean probe', async () => {
    const schemas = await buildSchemas();
    expect(schemas.PublicAvailabilitySlotDto.properties?.startTime).toMatchObject({ type: 'string', format: 'date-time' });
    expect(schemas.PublicAvailabilitySlotDto.properties?.endTime).toMatchObject({ type: 'string', format: 'date-time' });
    expect([...(schemas.PublicAvailabilityDayDto.required ?? [])].sort()).toEqual(['date', 'hasSlots'].sort());
  });

  it('documents the practitioner booking-options envelope with nullable labels', async () => {
    const schemas = await buildSchemas();
    expect([...(schemas.PublicPractitionerBookingOptionsDto.required ?? [])].sort()).toEqual(
      ['disabledDeliveryTypes', 'options', 'useCustomPricing'].sort(),
    );
    expect(schemas.PublicPractitionerBookingOptionsDto.properties?.options).toMatchObject({
      type: 'array',
      items: { $ref: '#/components/schemas/PublicPractitionerBookingOptionDto' },
    });
    expect(schemas.PublicPractitionerBookingOptionDto.properties?.price).toMatchObject({ type: 'number' });
    expect(schemas.PublicPractitionerBookingOptionDto.properties?.label).toMatchObject({ type: 'string', nullable: true });
  });

  it('documents the public package and family rows with their VAT rate', async () => {
    const schemas = await buildSchemas();
    expect(schemas.PublicPackageResponseDto.properties?.vatRate).toMatchObject({ type: 'number' });
    expect(schemas.PublicPackageResponseDto.required).toContain('vatRate');
    expect(schemas.PublicPackageFamilyWithVatResponseDto.properties?.vatRate).toMatchObject({ type: 'number' });
    expect(schemas.PublicPackageFamilyWithVatResponseDto.required).toContain('vatRate');
  });

  it('documents the program list wrapper and the detail-only enrollment flag', async () => {
    const schemas = await buildSchemas();
    expect(schemas.PublicProgramsListResponseDto.properties?.programs).toMatchObject({
      type: 'array',
      items: { $ref: '#/components/schemas/PublicProgramListItemDto' },
    });
    const list = Object.keys(schemas.PublicProgramListItemDto.properties ?? {}).sort();
    const detail = Object.keys(schemas.PublicProgramDetailResponseDto.properties ?? {}).sort();
    expect(detail.filter((key) => !list.includes(key))).toEqual(['isOpenForEnrollment']);
    expect(schemas.PublicProgramListItemDto.properties?.price).toMatchObject({ type: 'string' });
    expect(schemas.PublicProgramListItemDto.properties?.ref).toMatchObject({ type: 'integer' });
    expect(schemas.PublicProgramListItemDto.required ?? []).not.toContain('isOpenForEnrollment');
  });
});

// ── DIRECT hidden services stay excluded (runtime proof) ───────────────────

describe('public catalog service filter (unchanged)', () => {
  function buildHandler() {
    const prisma = {
      department: { findMany: jest.fn().mockResolvedValue([]) },
      serviceCategory: { findMany: jest.fn().mockResolvedValue([]) },
      service: { findMany: jest.fn().mockResolvedValue([]) },
      organizationSettings: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const cache = { getOrSet: jest.fn((_key: string, loader: () => unknown) => loader()) };
    const storage = { getSignedUrl: jest.fn() };
    const config = { getOrThrow: jest.fn(() => 'bucket') };
    const handler = new GetPublicCatalogHandlerClass(
      prisma as never,
      cache as never,
      storage as never,
      config as never,
    );
    return { handler, prisma };
  }

  it('omits the hidden direct-clinic service unless includeDirectClinics=true', async () => {
    const { handler, prisma } = buildHandler();
    await handler.execute({ includeDirectClinics: false });
    expect(prisma.service.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          isActive: true,
          isHidden: false,
          archivedAt: null,
          OR: [{ categoryId: null }, { category: { isActive: true } }],
        },
      }),
    );
  });

  it('adds only DIRECT-clinic hidden services when the caller opts in', async () => {
    const { handler, prisma } = buildHandler();
    await handler.execute({ includeDirectClinics: true });
    expect(prisma.service.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          isActive: true,
          archivedAt: null,
          OR: [
            { isHidden: false, OR: [{ categoryId: null }, { category: { isActive: true } }] },
            { isHidden: true, category: { isActive: true, bookingMode: 'DIRECT' } },
          ],
        },
      }),
    );
  });

  it('never selects a hidden service from a non-DIRECT category', async () => {
    const { handler, prisma } = buildHandler();
    await handler.execute({ includeDirectClinics: true });
    const arg = prisma.service.findMany.mock.calls[0][0] as { where: { OR: unknown[] } };
    const branches = JSON.stringify(arg.where.OR);
    expect(branches).toContain('"bookingMode":"DIRECT"');
    expect(branches).not.toContain('"bookingMode":"SERVICES"');
  });
});
