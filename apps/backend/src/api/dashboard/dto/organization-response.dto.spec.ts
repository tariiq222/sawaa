import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import type {
  Branch,
  BusinessHour,
  Department,
  EmployeeBranch,
  Holiday,
  OrganizationSettings,
  Rating,
  ServiceCategory,
} from '@prisma/client';
import {
  BranchAssignmentDeletedResponseDto,
  BranchBusinessHourResponseDto,
  BranchDetailResponseDto,
  BranchEmployeeAssignmentResponseDto,
  BranchEmployeeListEntryResponseDto,
  BranchEmployeeSummaryResponseDto,
  BranchHolidayResponseDto,
  BranchResponseDto,
  PaginatedBranchesDto,
} from './organization-branch-response.dto';
import {
  DeleteDepartmentResponseDto,
  DepartmentCategoryResponseDto,
  DepartmentListItemResponseDto,
  DepartmentResponseDto,
  PaginatedDepartmentsResponseDto,
} from './organization-department-response.dto';
import {
  HolidayRecordDto,
  OrganizationHoursRecordDto,
} from './organization-hours-response.dto';
import {
  BankTransferAccountResponseDto,
  BookingSettingsRecordResponseDto,
  BookingSettingsValuesDto,
  OrganizationRatingRecordResponseDto,
  OrganizationRatingVisibilityResponseDto,
  OrganizationSettingsResponseDto,
} from './organization-settings-response.dto';
import {
  OrganizationRatingResponseDto,
  OrganizationRatingsMetaDto,
  OrganizationRatingsResponseDto,
} from './organization-ratings-response.dto';
import type { ListMeta } from '../../../common/dto';
import type { CreateBranchHandler } from '../../../modules/org-config/branches/create-branch.handler';
import type { UpdateBranchHandler } from '../../../modules/org-config/branches/update-branch.handler';
import type { ListBranchesHandler } from '../../../modules/org-config/branches/list-branches.handler';
import type { GetBranchHandler } from '../../../modules/org-config/branches/get-branch.handler';
import type { DeleteBranchHandler } from '../../../modules/org-config/branches/delete-branch.handler';
import type { ListBranchEmployeesHandler } from '../../../modules/org-config/branches/list-branch-employees.handler';
import type { AssignEmployeeToBranchHandler } from '../../../modules/org-config/branches/assign-employee-to-branch.handler';
import type { UnassignEmployeeFromBranchHandler } from '../../../modules/org-config/branches/unassign-employee-from-branch.handler';
import type { CreateDepartmentHandler } from '../../../modules/org-config/departments/create-department.handler';
import type { UpdateDepartmentHandler } from '../../../modules/org-config/departments/update-department.handler';
import type { ListDepartmentsHandler } from '../../../modules/org-config/departments/list-departments.handler';
import type { GetDepartmentHandler } from '../../../modules/org-config/departments/get-department.handler';
import type { DeleteDepartmentHandler } from '../../../modules/org-config/departments/delete-department.handler';
import type { SetBusinessHoursHandler } from '../../../modules/org-config/business-hours/set-business-hours.handler';
import type { GetBusinessHoursHandler } from '../../../modules/org-config/business-hours/get-business-hours.handler';
import type { AddHolidayHandler } from '../../../modules/org-config/business-hours/add-holiday.handler';
import type { ListHolidaysHandler } from '../../../modules/org-config/business-hours/list-holidays.handler';
import type { SubmitRatingHandler } from '../../../modules/org-experience/ratings/submit-rating.handler';
import type { ListRatingsHandler } from '../../../modules/org-experience/ratings/list-ratings.handler';
import type { UpdateRatingVisibilityHandler } from '../../../modules/org-experience/ratings/update-rating-visibility.handler';
import type { GetOrgSettingsHandler } from '../../../modules/org-experience/org-settings/get-org-settings.handler';
import type { UpsertOrgSettingsHandler } from '../../../modules/org-experience/org-settings/upsert-org-settings.handler';
import type { GetBookingSettingsHandler } from '../../../modules/bookings/get-booking-settings/get-booking-settings.handler';
import type { UpsertBookingSettingsHandler } from '../../../modules/bookings/upsert-booking-settings/upsert-booking-settings.handler';

// ── Compile-time exactness: DTO <=> INFERRED handler output ────────────────
//
// No handler under src/modules is annotated with a DTO type and none imports
// from this layer (enforced by `git grep -l "api/dashboard/dto" -- src/modules`).
// Every assertion below reads the handler's INFERRED return type, so it proves
// BOTH that the DTO covers what the handler really produces and that it
// documents nothing extra. The controller's `Promise<Dto>` annotations only
// prove the one-way assignability that these checks imply.

type Expect<T extends true> = T;
type Id<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Result<T, M extends keyof T> = T[M] extends (...args: never[]) => Promise<infer R> ? R : never;

/**
 * `Id<A, B>` alone is identity-only, and the handlers return INTERSECTION types
 * (`Row & { relation: ... }`), which are not identity-equal to the flat DTO even
 * when every key and type matches. `Norm` flattens/rebuilds each object, so
 * `DeepEq` compares structure: same key set, same property types, recursively.
 * The negative controls at the bottom prove it still rejects an extra key, a
 * missing key, a changed type and a changed optionality.
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
type DeepEq<A, B> = Id<Norm<A>, Norm<B>>;

// ── Branches ───────────────────────────────────────────────────────────────

export type BranchMatchesPrisma = Expect<DeepEq<BranchResponseDto, Branch>>;
export type BusinessHourMatchesPrisma = Expect<DeepEq<BranchBusinessHourResponseDto, BusinessHour>>;
export type HolidayMatchesPrisma = Expect<DeepEq<BranchHolidayResponseDto, Holiday>>;
/** GET /branches/:branchId includes both relations (`include: { businessHours, holidays }`). */
type BranchWithRelations = Branch & { businessHours: BusinessHour[]; holidays: Holiday[] };
export type BranchDetailMatchesInclude = Expect<DeepEq<BranchDetailResponseDto, BranchWithRelations>>;
/** GET /branches wraps `toListResponse(items, total, page, limit)`. */
export type ListBranchesMatches = Expect<
  DeepEq<Result<ListBranchesHandler, 'execute'>, PaginatedBranchesDto>
>;
export type CreateBranchMatches = Expect<DeepEq<Result<CreateBranchHandler, 'execute'>, BranchResponseDto>>;
export type UpdateBranchMatches = Expect<DeepEq<Result<UpdateBranchHandler, 'execute'>, BranchResponseDto>>;
export type GetBranchMatches = Expect<DeepEq<Result<GetBranchHandler, 'execute'>, BranchDetailResponseDto>>;
/** DELETE answers 204; the handler still returns the deleted id. */
export type DeleteBranchMatches = Expect<DeepEq<Result<DeleteBranchHandler, 'execute'>, { id: string }>>;

/** The mapper in `list-branch-employees.handler.ts` emits exactly this row. */
type BranchEmployeeRow = {
  id: string;
  employeeId: string;
  branchId: string;
  employee: {
    id: string;
    isActive: boolean;
    specialty: string | null;
    specialtyAr: string | null;
    name: string;
    nameEn: string;
    email: string | null;
  };
};
export type BranchEmployeeRowMatches = Expect<DeepEq<BranchEmployeeSummaryResponseDto, BranchEmployeeRow['employee']>>;
export type ListBranchEmployeesMatches = Expect<
  DeepEq<Result<ListBranchEmployeesHandler, 'execute'>, BranchEmployeeListEntryResponseDto[]>
>;
export type AssignEmployeeMatchesPrisma = Expect<
  DeepEq<Result<AssignEmployeeToBranchHandler, 'execute'>, EmployeeBranch>
>;
export type AssignEmployeeMatches = Expect<
  DeepEq<Result<AssignEmployeeToBranchHandler, 'execute'>, BranchEmployeeAssignmentResponseDto>
>;
export type UnassignEmployeeMatches = Expect<
  DeepEq<Result<UnassignEmployeeFromBranchHandler, 'execute'>, BranchAssignmentDeletedResponseDto>
>;

// ── Departments ────────────────────────────────────────────────────────────

export type DepartmentMatchesPrisma = Expect<DeepEq<DepartmentResponseDto, Department>>;
export type DepartmentCategoryMatchesPrisma = Expect<DeepEq<DepartmentCategoryResponseDto, ServiceCategory>>;
/** The list decorates each department with its active categories plus a computed count. */
type DepartmentListRow = Department & { categories: ServiceCategory[]; bookableCategoriesCount: number };
export type DepartmentListRowMatches = Expect<DeepEq<DepartmentListItemResponseDto, DepartmentListRow>>;
export type ListDepartmentsMatches = Expect<
  DeepEq<Result<ListDepartmentsHandler, 'execute'>, PaginatedDepartmentsResponseDto>
>;
export type CreateDepartmentMatches = Expect<DeepEq<Result<CreateDepartmentHandler, 'execute'>, DepartmentResponseDto>>;
/**
 * UPDATE ends with `department.findFirst(...)`, which is nullable. The row is
 * confirmed to exist first (`updateMany` count), so the null is only reachable
 * on a concurrent delete; the documented type keeps it honest.
 */
export type UpdateDepartmentMatches = Expect<
  DeepEq<Result<UpdateDepartmentHandler, 'execute'>, DepartmentResponseDto | null>
>;
export type GetDepartmentMatches = Expect<DeepEq<Result<GetDepartmentHandler, 'execute'>, DepartmentResponseDto>>;
export type DeleteDepartmentMatches = Expect<
  DeepEq<Result<DeleteDepartmentHandler, 'execute'>, DeleteDepartmentResponseDto>
>;

// ── Hours and holidays ─────────────────────────────────────────────────────

export type HoursRecordMatchesPrisma = Expect<DeepEq<OrganizationHoursRecordDto, BusinessHour>>;
export type HolidayRecordMatchesPrisma = Expect<DeepEq<HolidayRecordDto, Holiday>>;
export type SetBusinessHoursMatches = Expect<
  DeepEq<Result<SetBusinessHoursHandler, 'execute'>, OrganizationHoursRecordDto[]>
>;
export type GetBusinessHoursMatches = Expect<
  DeepEq<Result<GetBusinessHoursHandler, 'execute'>, OrganizationHoursRecordDto[]>
>;
export type AddHolidayMatches = Expect<DeepEq<Result<AddHolidayHandler, 'execute'>, HolidayRecordDto>>;
export type ListHolidaysMatches = Expect<DeepEq<Result<ListHolidaysHandler, 'execute'>, HolidayRecordDto[]>>;

// ── Ratings ────────────────────────────────────────────────────────────────

export type RatingRecordMatchesPrisma = Expect<DeepEq<OrganizationRatingRecordResponseDto, Rating>>;
export type SubmitRatingMatches = Expect<
  DeepEq<Result<SubmitRatingHandler, 'execute'>, OrganizationRatingRecordResponseDto>
>;
type EnrichedRating = Rating & {
  client: { id: string; name: string } | null;
  employee: { id: string; name: string; nameEn: string | null } | null;
};
export type EnrichedRatingMatches = Expect<DeepEq<OrganizationRatingResponseDto, EnrichedRating>>;
export type RatingsMetaMatches = Expect<DeepEq<OrganizationRatingsMetaDto, ListMeta>>;
export type ListRatingsMatches = Expect<
  DeepEq<Result<ListRatingsHandler, 'execute'>, OrganizationRatingsResponseDto>
>;
export type UpdateRatingVisibilityMatches = Expect<
  DeepEq<Result<UpdateRatingVisibilityHandler, 'execute'>, OrganizationRatingVisibilityResponseDto>
>;

// ── Organization settings ──────────────────────────────────────────────────

export type OrgSettingsMatchesPrisma = Expect<DeepEq<OrganizationSettingsResponseDto, OrganizationSettings>>;
/** `findFirst` is nullable: no settings row means no body. */
export type GetOrgSettingsMatches = Expect<
  DeepEq<Result<GetOrgSettingsHandler, 'execute'>, OrganizationSettingsResponseDto | null>
>;
export type UpsertOrgSettingsMatches = Expect<
  DeepEq<Result<UpsertOrgSettingsHandler, 'execute'>, OrganizationSettingsResponseDto>
>;

// ── Booking settings ───────────────────────────────────────────────────────

/** The fallback object is the row minus its identity columns. */
type ResolvedBookingSettingsValues = Omit<
  BookingSettingsRecordResponseDto,
  'id' | 'branchId' | 'createdAt' | 'updatedAt'
>;
export type BookingSettingsValuesMatchesFallback = Expect<
  DeepEq<BookingSettingsValuesDto, ResolvedBookingSettingsValues>
>;
export type GetBookingSettingsMatches = Expect<
  DeepEq<
    Result<GetBookingSettingsHandler, 'execute'>,
    BookingSettingsRecordResponseDto | BookingSettingsValuesDto
  >
>;
export type UpsertBookingSettingsMatches = Expect<
  DeepEq<Result<UpsertBookingSettingsHandler, 'execute'>, BookingSettingsRecordResponseDto>
>;

// ── Negative controls: the DeepEq above is not vacuous ─────────────────────

type BranchRow = Result<CreateBranchHandler, 'execute'>;
export type N_extraKey = DeepEq<BranchRow, BranchResponseDto & { extra: 1 }>;
export type N_missingKey = DeepEq<BranchRow, Omit<BranchResponseDto, 'timezone'>>;
export type N_changedType = DeepEq<BranchRow, Omit<BranchResponseDto, 'isMain'> & { isMain: string }>;
export type N_optionality = DeepEq<BranchRow, Omit<BranchResponseDto, 'country'> & { country?: string }>;
/** Nested: a changed type two levels down (inside a branch detail holiday). */
type BadDetail = Omit<BranchDetailResponseDto, 'holidays'> & {
  holidays: Array<Omit<BranchHolidayResponseDto, 'nameEn'> & { nameEn: string }>;
};
export type N_nestedType = DeepEq<Result<GetBranchHandler, 'execute'>, BadDetail>;
/** Nested: a missing array-item field inside the department list row. */
type BadDepartmentRow = Omit<DepartmentListItemResponseDto, 'categories'> & {
  categories: Array<Omit<DepartmentCategoryResponseDto, 'kind'>>;
};
export type N_nestedMissing = DeepEq<
  Result<ListDepartmentsHandler, 'execute'>['items'][number],
  BadDepartmentRow
>;
export type ControlsReject = Expect<
  [N_extraKey, N_missingKey, N_changedType, N_optionality, N_nestedType, N_nestedMissing] extends
    [false, false, false, false, false, false] ? true : false
>;

// ── Schema-level shape assertions ──────────────────────────────────────────

async function buildSchemas(): Promise<Record<string, SchemaObject>> {
  const moduleRef = await Test.createTestingModule({}).compile();
  const app = moduleRef.createNestApplication();
  try {
    const document = SwaggerModule.createDocument(app, new DocumentBuilder().build(), {
      extraModels: [
        BranchResponseDto,
        BranchDetailResponseDto,
        BranchEmployeeListEntryResponseDto,
        BranchEmployeeAssignmentResponseDto,
        BranchAssignmentDeletedResponseDto,
        PaginatedBranchesDto,
        DepartmentResponseDto,
        DepartmentListItemResponseDto,
        PaginatedDepartmentsResponseDto,
        DeleteDepartmentResponseDto,
        OrganizationHoursRecordDto,
        HolidayRecordDto,
        OrganizationSettingsResponseDto,
        BookingSettingsValuesDto,
        BookingSettingsRecordResponseDto,
        OrganizationRatingRecordResponseDto,
        OrganizationRatingVisibilityResponseDto,
        BankTransferAccountResponseDto,
      ],
    });
    return (document.components?.schemas ?? {}) as Record<string, SchemaObject>;
  } finally {
    await app.close();
  }
}

describe('organization response schemas (output shape)', () => {
  it('documents the branch row, and the detail adds exactly the two relations', async () => {
    const schemas = await buildSchemas();
    const detailExtra = Object.keys(schemas.BranchDetailResponseDto.properties ?? {})
      .filter((key) => !(key in (schemas.BranchResponseDto.properties ?? {})))
      .sort();
    expect(detailExtra).toEqual(['businessHours', 'holidays']);
    expect(schemas.BranchDetailResponseDto.properties?.businessHours).toMatchObject({
      type: 'array',
      items: { $ref: '#/components/schemas/BranchBusinessHourResponseDto' },
    });
    expect(schemas.BranchDetailResponseDto.properties?.holidays).toMatchObject({
      type: 'array',
      items: { $ref: '#/components/schemas/BranchHolidayResponseDto' },
    });
    expect(schemas.BranchResponseDto.properties?.latitude).toMatchObject({ type: 'number', nullable: true });
    expect(schemas.BranchResponseDto.properties?.createdAt).toMatchObject({ type: 'string', format: 'date-time' });
  });

  it('documents the branch employee list entry with its employee summary', async () => {
    const schemas = await buildSchemas();
    expect([...(schemas.BranchEmployeeListEntryResponseDto.required ?? [])].sort()).toEqual(
      ['branchId', 'employee', 'employeeId', 'id'].sort(),
    );
    expect(schemas.BranchEmployeeListEntryResponseDto.properties?.employee).toMatchObject({
      allOf: [{ $ref: '#/components/schemas/BranchEmployeeSummaryResponseDto' }],
    });
    expect([...(schemas.BranchEmployeeSummaryResponseDto.required ?? [])].sort()).toEqual(
      ['email', 'id', 'isActive', 'name', 'nameEn', 'specialty', 'specialtyAr'].sort(),
    );
  });

  it('documents integer day-of-week and score ranges', async () => {
    const schemas = await buildSchemas();
    expect(schemas.BranchBusinessHourResponseDto.properties?.dayOfWeek).toMatchObject({ type: 'number' });
    expect(schemas.OrganizationHoursRecordDto.properties?.dayOfWeek).toMatchObject({
      type: 'integer',
      minimum: 0,
      maximum: 6,
    });
    expect(schemas.OrganizationRatingRecordResponseDto.properties?.score).toMatchObject({
      type: 'integer',
      minimum: 1,
      maximum: 5,
    });
  });

  it('documents Prisma Decimal columns as strings, never numbers', async () => {
    const schemas = await buildSchemas();
    expect(schemas.OrganizationSettingsResponseDto.properties?.vatRate).toMatchObject({ type: 'string' });
    expect(schemas.OrganizationSettingsResponseDto.properties?.bankTransferAccounts).toMatchObject({
      type: 'array',
      items: { $ref: '#/components/schemas/BankTransferAccountResponseDto' },
    });
    expect(schemas.OrganizationSettingsResponseDto.properties?.socialMedia).toMatchObject({
      type: 'object',
      nullable: true,
    });
  });

  it('documents booking settings as the persisted row, and the defaults without row identity', async () => {
    const schemas = await buildSchemas();
    const recordKeys = Object.keys(schemas.BookingSettingsRecordResponseDto.properties ?? {});
    const valueKeys = Object.keys(schemas.BookingSettingsValuesDto.properties ?? {});
    expect(recordKeys.filter((key) => !valueKeys.includes(key)).sort()).toEqual(
      ['branchId', 'createdAt', 'id', 'updatedAt'].sort(),
    );
    expect(schemas.BookingSettingsRecordResponseDto.properties?.branchId).toMatchObject({
      type: 'string',
      nullable: true,
    });
    expect(schemas.BookingSettingsValuesDto.properties?.clientCancelCutoffMode).toMatchObject({
      type: 'string',
      nullable: true,
      enum: ['BEFORE_START', 'BEFORE_CHECK_IN'],
    });
    expect(schemas.BookingSettingsValuesDto.properties?.maxReschedulesPerBooking).toMatchObject({
      type: 'integer',
    });
  });

  it('documents the paginated wrappers with their item and meta members', async () => {
    const schemas = await buildSchemas();
    expect(schemas.PaginatedBranchesDto.properties?.items).toMatchObject({
      type: 'array',
      items: { $ref: '#/components/schemas/BranchResponseDto' },
    });
    expect(schemas.PaginatedBranchesDto.properties?.meta).toMatchObject({
      allOf: [{ $ref: '#/components/schemas/BranchListMetaDto' }],
    });
    expect(schemas.PaginatedDepartmentsResponseDto.properties?.items).toMatchObject({
      type: 'array',
      items: { $ref: '#/components/schemas/DepartmentListItemResponseDto' },
    });
  });

  it('documents the deleted-assignment and deleted-department shapes', async () => {
    const schemas = await buildSchemas();
    expect(Object.keys(schemas.BranchAssignmentDeletedResponseDto.properties ?? {})).toEqual(['id']);
    expect(schemas.DeleteDepartmentResponseDto.properties?.deleted).toMatchObject({ type: 'boolean' });
  });
});
