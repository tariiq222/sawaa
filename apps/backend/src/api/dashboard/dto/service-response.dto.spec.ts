import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import {
  PaginatedServicesResponseDto,
  ServiceBookingConfigResponseDto,
  ServiceDetailResponseDto,
  ServiceEmployeeAssignmentDto,
  ServiceListItemResponseDto,
  ServiceRestoreResponseDto,
} from './service-response.dto';
import { ServiceDurationOptionRecordDto, ServiceRecordDto } from './employee-response.dto';
import type { CreateServiceHandler } from '../../../modules/org-experience/services/create-service.handler';
import type { ListServicesHandler } from '../../../modules/org-experience/services/list-services.handler';
import type { GetServiceHandler } from '../../../modules/org-experience/services/get-service.handler';
import type { UpdateServiceHandler } from '../../../modules/org-experience/services/update-service.handler';
import type { ArchiveServiceHandler } from '../../../modules/org-experience/services/archive-service.handler';
import type { RestoreServiceHandler } from '../../../modules/org-experience/services/restore-service.handler';
import type { ListServiceEmployeesHandler } from '../../../modules/org-experience/services/list-service-employees.handler';
import type { GetServiceBookingConfigsHandler } from '../../../modules/org-experience/services/get-service-booking-configs.handler';
import type { SetServiceBookingConfigsHandler } from '../../../modules/org-experience/services/set-service-booking-configs.handler';
import type { GetDurationOptionsHandler } from '../../../modules/org-experience/services/get-duration-options.handler';
import type { SetDurationOptionsHandler } from '../../../modules/org-experience/services/set-duration-options.handler';

// ── Compile-time exactness: DTO <=> handler output ──────────────────────────
//
// Controller return types prove assignability in one direction (the handler
// fits the DTO). They cannot prove the DTO does not document a key the handler
// never produces. These assertions check both directions against the handlers
// themselves, so a new/renamed/retyped handler field becomes a type error here.

type Expect<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Result<T, M extends keyof T> = T[M] extends (...args: never[]) => Promise<infer R> ? R : never;

export type CreateServiceMatches = Expect<Equal<Result<CreateServiceHandler, 'execute'>, ServiceDetailResponseDto>>;
export type ListServicesMatches = Expect<Equal<Result<ListServicesHandler, 'execute'>, PaginatedServicesResponseDto>>;
export type GetServiceMatches = Expect<Equal<Result<GetServiceHandler, 'execute'>, ServiceDetailResponseDto>>;
export type UpdateServiceMatches = Expect<Equal<Result<UpdateServiceHandler, 'execute'>, ServiceDetailResponseDto>>;
/**
 * The archive route answers 204, so the row the handler returns never reaches a
 * client. It is still the raw `Service` row, which is exactly `ServiceRecordDto`.
 */
export type ArchiveServiceMatches = Expect<Equal<Result<ArchiveServiceHandler, 'execute'>, ServiceRecordDto>>;
export type RestoreServiceMatches = Expect<Equal<Result<RestoreServiceHandler, 'execute'>, ServiceRestoreResponseDto>>;
export type ListServiceEmployeesMatches = Expect<
  Equal<Result<ListServiceEmployeesHandler, 'execute'>, ServiceEmployeeAssignmentDto[]>
>;
export type GetServiceBookingConfigsMatches = Expect<
  Equal<Result<GetServiceBookingConfigsHandler, 'execute'>, ServiceBookingConfigResponseDto[]>
>;
export type SetServiceBookingConfigsMatches = Expect<
  Equal<Result<SetServiceBookingConfigsHandler, 'execute'>, ServiceBookingConfigResponseDto[]>
>;
export type GetDurationOptionsMatches = Expect<
  Equal<Result<GetDurationOptionsHandler, 'execute'>, ServiceDurationOptionRecordDto[]>
>;
export type SetDurationOptionsMatches = Expect<
  Equal<Result<SetDurationOptionsHandler, 'execute'>, ServiceDurationOptionRecordDto[]>
>;

async function buildSchemas(): Promise<Record<string, SchemaObject>> {
  const moduleRef = await Test.createTestingModule({}).compile();
  const app = moduleRef.createNestApplication();
  try {
    const document = SwaggerModule.createDocument(app, new DocumentBuilder().build(), {
      extraModels: [
        ServiceDetailResponseDto,
        ServiceListItemResponseDto,
        ServiceRestoreResponseDto,
        PaginatedServicesResponseDto,
        ServiceBookingConfigResponseDto,
        ServiceEmployeeAssignmentDto,
      ],
    });
    return (document.components?.schemas ?? {}) as Record<string, SchemaObject>;
  } finally {
    await app.close();
  }
}

describe('service response schemas (output shape)', () => {
  it('documents the raw row, its category and its duration options on a detail payload', async () => {
    const schemas = await buildSchemas();
    const schema = schemas.ServiceDetailResponseDto;
    // `ServiceRecordDto` is the shared base; assert the shape directly so the
    // 26 inherited row fields stay exactly the ones the snapshot already ships.
    expect([...(schema.required ?? [])].sort()).toEqual(
      [
        'archivedAt', 'bufferMinutes', 'category', 'categoryId', 'commissionRateOverride',
        'createdAt', 'currency', 'depositAmount', 'depositEnabled', 'descriptionAr',
        'descriptionEn', 'durationMins', 'durationOptions', 'hideDurationOnBooking',
        'hidePriceOnBooking', 'iconBgColor', 'iconName', 'id', 'imageUrl', 'isActive',
        'isHidden', 'maxAdvanceDays', 'minLeadMinutes', 'nameAr', 'nameEn', 'price',
        'ref', 'updatedAt',
      ].sort(),
    );
    expect(schema.properties?.category).toMatchObject({
      allOf: [{ $ref: '#/components/schemas/ServiceEmbeddedCategoryDto' }],
      nullable: true,
    });
    expect(schema.properties?.durationOptions).toMatchObject({
      type: 'array',
      items: { $ref: '#/components/schemas/ServiceDurationOptionRecordDto' },
    });
  });

  it('adds only the employee count on a list row', async () => {
    const schemas = await buildSchemas();
    const detail = Object.keys(schemas.ServiceDetailResponseDto.properties ?? {}).sort();
    const list = Object.keys(schemas.ServiceListItemResponseDto.properties ?? {}).sort();
    expect(list.filter((key) => !detail.includes(key))).toEqual(['employeeCount']);
    expect(schemas.ServiceListItemResponseDto.properties?.employeeCount).toMatchObject({ type: 'integer' });
    expect(schemas.ServiceListItemResponseDto.properties?.category).toMatchObject({
      allOf: [{ $ref: '#/components/schemas/ServiceEmbeddedCategoryListItemDto' }],
    });
  });

  it('documents the paginated wrapper members', async () => {
    const schema = (await buildSchemas()).PaginatedServicesResponseDto;
    expect(schema.properties?.items).toMatchObject({
      type: 'array',
      items: { $ref: '#/components/schemas/ServiceListItemResponseDto' },
    });
    expect(schema.properties?.meta).toMatchObject({
      allOf: [{ $ref: '#/components/schemas/ListMetaDto' }],
    });
  });

  it('keeps the restore payload nullable in the same places as the detail payload', async () => {
    const schemas = await buildSchemas();
    expect([...(schemas.ServiceRestoreResponseDto.required ?? [])].sort()).toEqual(
      [...(schemas.ServiceDetailResponseDto.required ?? [])].sort(),
    );
    expect(schemas.ServiceRestoreResponseDto.properties?.imageUrl).toMatchObject({ type: 'string', nullable: true });
  });

  it('documents each delivery type with its options and windows', async () => {
    const schemas = await buildSchemas();
    const schema = schemas.ServiceBookingConfigResponseDto;
    expect(schema.properties?.price).toMatchObject({ type: 'string' });
    expect(schema.properties?.durationOptions).toMatchObject({
      type: 'array',
      items: { $ref: '#/components/schemas/ServiceDurationOptionRecordDto' },
    });
    expect(schema.properties?.availabilityWindows).toMatchObject({
      type: 'array',
      items: { $ref: '#/components/schemas/ServiceAvailabilityWindowRecordDto' },
    });
  });

  it('documents a practitioner row with its effective durations', async () => {
    const schema = (await buildSchemas()).ServiceEmployeeAssignmentDto;
    expect([...(schema.required ?? [])].sort()).toEqual(
      [
        'id', 'employee', 'serviceTypes', 'hasCustomPricing', 'customDuration',
        'bufferMinutes', 'availableTypes', 'disabledDeliveryTypes',
        'useCustomPricing', 'isActive', 'effectiveDurations',
      ].sort(),
    );
    expect(schema.properties?.effectiveDurations).toMatchObject({
      type: 'array',
      items: { $ref: '#/components/schemas/EmployeeEffectiveDurationGroupDto' },
    });
  });
});
