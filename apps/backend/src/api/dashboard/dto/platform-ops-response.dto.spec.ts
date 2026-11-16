import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import type { Integration, ProblemReport } from '@prisma/client';
import {
  PlatformIntegrationListItemResponseDto,
  PlatformIntegrationResponseDto,
  ProblemReportListResponseDto,
  ProblemReportResponseDto,
} from './platform-response.dto';
import { ZoomConfigResponseDto, ZoomTestResultDto } from './zoom-response.dto';
import {
  OPS_GENERATED_REPORT_SCHEMA,
  OPS_PACKAGE_REPORT_SCHEMA,
  OpsActivityLogEntryDto,
  OpsActivityLogListResponseDto,
  OpsActivityLogUserDto,
  OpsActivityReportDto,
  OpsBookingsReportDto,
  OpsClientsReportDto,
  OpsOutboxFailedEventDto,
  OpsOutboxFailedEventListResponseDto,
  OpsOutboxRetryResponseDto,
  OpsOverviewReportDto,
  OpsPackageConsumptionReportDto,
  OpsPackageOutstandingCreditReportDto,
  OpsPackageSalesReportDto,
  OpsPractitionerDetailReportDto,
  OpsPractitionersReportDto,
  OpsRatingsReportDto,
  OpsRefundedPackagesEventsReportDto,
  OpsRefundedPackagesLegacyReportDto,
  OpsRefundedUndatedHistoryDto,
  OpsRevenueReportDto,
  OpsServicesReportDto,
} from './ops-response.dto';
import type { CreateProblemReportHandler } from '../../../modules/platform/problem-reports/create-problem-report.handler';
import type { ListProblemReportsHandler } from '../../../modules/platform/problem-reports/list-problem-reports.handler';
import type { UpdateProblemReportStatusHandler } from '../../../modules/platform/problem-reports/update-problem-report-status.handler';
import type { UpsertIntegrationHandler } from '../../../modules/platform/integrations/upsert-integration.handler';
import type { ListIntegrationsHandler } from '../../../modules/platform/integrations/list-integrations.handler';
import type { GetZoomConfigHandler } from '../../../modules/integrations/zoom/get-zoom-config.handler';
import type { UpsertZoomConfigHandler } from '../../../modules/integrations/zoom/upsert-zoom-config.handler';
import type { TestZoomConfigHandler } from '../../../modules/integrations/zoom/test-zoom-config.handler';
import type { ListActivityHandler } from '../../../modules/ops/log-activity/list-activity.handler';
import type { ListTerminalFailedOutboxHandler } from '../../../modules/ops/outbox/list-terminal-failed-outbox.handler';
import type { RetryFailedOutboxEventHandler } from '../../../modules/ops/outbox/retry-failed-outbox-event.handler';
import type {
  OutboxFailedEventView,
  OutboxRetryEventView,
} from '../../../modules/ops/outbox/outbox-event.view';
import type { OverviewReportResult } from '../../../modules/ops/generate-report/overview-report.builder';
import type { RevenueReportResult } from '../../../modules/ops/generate-report/revenue-report.builder';
import type { BookingsReportResult } from '../../../modules/ops/generate-report/bookings-report.builder';
import type { ClientsReportResult } from '../../../modules/ops/generate-report/clients-report.builder';
import type {
  PractitionerDetailResult,
  PractitionersReportResult,
} from '../../../modules/ops/generate-report/practitioners-report.builder';
import type { ServicesReportResult } from '../../../modules/ops/generate-report/services-report.builder';
import type { RatingsReportResult } from '../../../modules/ops/generate-report/ratings-report.builder';
import type { ActivityReportResult } from '../../../modules/ops/generate-report/activity-report.builder';
import type { PackageSalesReportResult } from '../../../modules/ops/generate-report/package-sales-report.builder';
import type { OutstandingCreditReportResult } from '../../../modules/ops/generate-report/outstanding-credit-report.builder';
import type { PackageConsumptionReportResult } from '../../../modules/ops/generate-report/package-consumption-report.builder';
import type { RefundedPackagesReportResult } from '../../../modules/ops/generate-report/refunded-packages-report.builder';
import type { ListMeta } from '../../../common/dto';

// ── Compile-time exactness: DTO <=> INFERRED producer output ────────────────
//
// No handler under src/modules is annotated with a DTO type and none imports
// from this layer (enforced by `git grep -l "api/dashboard/dto" -- src/modules`).
// Every assertion below reads the producer's inferred type, so it proves BOTH
// that the DTO covers what the handler really returns and that it documents
// nothing extra.
//
// `POST /dashboard/ops/reports` is the one route whose controller body is not
// the handler result: `GenerateReportHandler.execute` returns an envelope
// (`{reportId,type,format,status,data?,excelBuffer?}`) and the controller
// returns `data`. The builder result types are what `data` holds, so the nine
// report DTOs are pinned to those builders instead — that is a strictly
// stronger check than comparing against `unknown`.

type Expect<T extends true> = T;
type Result<T, M extends keyof T> = T[M] extends (...args: never[]) => Promise<infer R> ? R : never;

/**
 * Structural equality. DTO fields are classes while producers return object
 * literals or Prisma row types, so identity comparison is useless: `Norm`
 * flattens every object and array element first, then `Extends` checks
 * assignability in BOTH directions. Optionality survives because `Norm` keeps
 * a lone `undefined` in the property type, so `required` vs `optional` is still
 * a mismatch. Negative controls at the bottom prove the helper is not vacuous.
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

/** `GenerateReportHandler` spreads `previous` onto the same payload when asked. */
type WithPrevious<T> = T & { previous?: T };
/** Canonical `{ items, meta }` envelope from `toListResponse`. */
type Envelope<T> = { items: T[]; meta: ListMeta };

// ── Platform: problem reports ──────────────────────────────────────────────

export type CreateProblemReportMatches = Expect<Equal<Result<CreateProblemReportHandler, 'execute'>, ProblemReportResponseDto>>;
export type UpdateProblemReportStatusMatches = Expect<Equal<Result<UpdateProblemReportStatusHandler, 'execute'>, ProblemReportResponseDto>>;
export type ListProblemReportsMatches = Expect<Equal<Result<ListProblemReportsHandler, 'execute'>, ProblemReportListResponseDto>>;
/** The row DTO is exactly the persisted `ProblemReport` model — no more, no less. */
export type ProblemReportMatchesRow = Expect<Equal<ProblemReportResponseDto, ProblemReport>>;
export type ProblemReportListMatchesEnvelope = Expect<Equal<ProblemReportListResponseDto, Envelope<ProblemReport>>>;
export type ProblemReportMetaMatchesListMeta = Expect<Equal<ProblemReportListResponseDto['meta'], ListMeta>>;

// ── Platform: generic third-party integrations ─────────────────────────────

export type UpsertIntegrationMatches = Expect<Equal<Result<UpsertIntegrationHandler, 'execute'>, PlatformIntegrationResponseDto>>;
export type ListIntegrationsMatches = Expect<Equal<Result<ListIntegrationsHandler, 'execute'>, PlatformIntegrationListItemResponseDto[]>>;
/** The upsert echoes the persisted `Integration` row (config is the ciphertext blob). */
export type IntegrationRowMatchesRow = Expect<Equal<PlatformIntegrationResponseDto, Integration>>;
/** The list projection drops `config` — its presence would leak ciphertext. */
export type IntegrationListHasNoConfig = Expect<
  Equal<'config' extends keyof PlatformIntegrationListItemResponseDto ? true : false, false>
>;
export type IntegrationListHasHasConfig = Expect<Equal<PlatformIntegrationListItemResponseDto['hasConfig'], boolean>>;

// ── Zoom (credentials are write-only) ──────────────────────────────────────

export type GetZoomMatches = Expect<Equal<Result<GetZoomConfigHandler, 'execute'>, ZoomConfigResponseDto>>;
export type UpsertZoomMatches = Expect<Equal<Result<UpsertZoomConfigHandler, 'execute'>, ZoomConfigResponseDto>>;
export type TestZoomMatches = Expect<Equal<Result<TestZoomConfigHandler, 'execute'>, ZoomTestResultDto>>;

type ZoomSecretKeys = 'zoomClientId' | 'zoomClientSecret' | 'zoomAccountId' | 'clientSecret' | 'ciphertext' | 'config';
export type ZoomConfigHasNoSecret = Expect<Equal<Extract<ZoomSecretKeys, keyof ZoomConfigResponseDto>, never>>;
export type ZoomTestHasNoSecret = Expect<Equal<Extract<ZoomSecretKeys, keyof ZoomTestResultDto>, never>>;
export type ZoomConfigKeys = Expect<Equal<keyof ZoomConfigResponseDto, 'configured' | 'isActive'>>;
export type ZoomTestKeys = Expect<Equal<keyof ZoomTestResultDto, 'ok' | 'error'>>;

// ── Ops: activity log ──────────────────────────────────────────────────────

export type ListActivityMatches = Expect<Equal<Result<ListActivityHandler, 'execute'>, OpsActivityLogListResponseDto>>;
export type ActivityLogListMatchesEnvelope = Expect<
  Equal<OpsActivityLogListResponseDto, Envelope<OpsActivityLogEntryDto>>
>;
export type ActivityLogUserMatches = Expect<
  Equal<OpsActivityLogEntryDto['user'], OpsActivityLogUserDto | null>
>;

// ── Ops: terminal-failed outbox ────────────────────────────────────────────

export type ListFailedOutboxMatches = Expect<Equal<Result<ListTerminalFailedOutboxHandler, 'execute'>, OpsOutboxFailedEventListResponseDto>>;
export type RetryFailedOutboxMatches = Expect<Equal<Result<RetryFailedOutboxEventHandler, 'execute'>, OpsOutboxRetryResponseDto>>;
export type OutboxFailedViewMatches = Expect<Equal<OpsOutboxFailedEventDto, OutboxFailedEventView>>;
/** The retry view widens `status` to the durable lane; the old doc said `PENDING` only. */
export type OutboxRetryViewMatches = Expect<Equal<OpsOutboxRetryResponseDto, OutboxRetryEventView>>;
export type OutboxRetryHasBothStatuses = Expect<Equal<OpsOutboxRetryResponseDto['status'], 'PENDING' | 'PENDING_V2'>>;
/** The payload column must never appear in either outbox shape. */
export type OutboxHasNoPayload = Expect<Equal<Extract<'payload' | 'deliveryLane' | 'lockedUntil', keyof OpsOutboxRetryResponseDto>, never>>;

// ── Ops: generated reports (one DTO per builder result) ────────────────────

export type OverviewMatches = Expect<Equal<OpsOverviewReportDto, WithPrevious<OverviewReportResult>>>;
export type RevenueMatches = Expect<Equal<OpsRevenueReportDto, WithPrevious<RevenueReportResult>>>;
export type BookingsMatches = Expect<Equal<OpsBookingsReportDto, WithPrevious<BookingsReportResult>>>;
export type ClientsMatches = Expect<Equal<OpsClientsReportDto, WithPrevious<ClientsReportResult>>>;
export type PractitionersMatches = Expect<Equal<OpsPractitionersReportDto, WithPrevious<PractitionersReportResult>>>;
export type PractitionerDetailMatches = Expect<Equal<OpsPractitionerDetailReportDto, WithPrevious<PractitionerDetailResult>>>;
export type ServicesMatches = Expect<Equal<OpsServicesReportDto, WithPrevious<ServicesReportResult>>>;
export type RatingsMatches = Expect<Equal<OpsRatingsReportDto, WithPrevious<RatingsReportResult>>>;
export type ActivityReportMatches = Expect<Equal<OpsActivityReportDto, ActivityReportResult>>;
/** ACTIVITY is excluded from compare-with-previous, so it carries no `previous`. */
export type ActivityReportHasNoPrevious = Expect<
  Equal<'previous' extends keyof OpsActivityReportDto ? true : false, false>
>;

// ── Ops: package reports (discriminated by `kind`) ─────────────────────────

export type PackageSalesMatches = Expect<Equal<OpsPackageSalesReportDto, PackageSalesReportResult & { kind: 'SALES' }>>;
export type PackageOutstandingMatches = Expect<
  Equal<OpsPackageOutstandingCreditReportDto, OutstandingCreditReportResult & { kind: 'OUTSTANDING_CREDIT' }>
>;
export type PackageConsumptionMatches = Expect<
  Equal<OpsPackageConsumptionReportDto, PackageConsumptionReportResult & { kind: 'CONSUMPTION' }>
>;
export type PackageRefundedMatches = Expect<
  Equal<OpsRefundedPackagesEventsReportDto | OpsRefundedPackagesLegacyReportDto, RefundedPackagesReportResult & { kind: 'REFUNDED' }>
>;
/**
 * `complete` is documented as the stored boolean, not narrowed to the mode:
 * the wire carries whatever `reconciliationGate` computed. The dashboard type
 * may narrow it per mode — that is a client-side refinement, not the contract.
 */
export type RefundedEventsCompleteIsStoredBoolean = Expect<
  Equal<OpsRefundedPackagesEventsReportDto['historyReconciliation'], { complete: boolean; unresolvedPurchaseCount: number }>
>;
export type RefundedLegacyCompleteIsStoredBoolean = Expect<
  Equal<OpsRefundedPackagesLegacyReportDto['historyReconciliation'], { complete: boolean; unresolvedPurchaseCount: number }>
>;

// ── Negative controls: the equality helper is not vacuous ───────────────────

type N_extraKey = Equal<ZoomConfigResponseDto, ZoomConfigResponseDto & { ciphertext: string }>;
type N_missingKey = Equal<ZoomConfigResponseDto, Omit<ZoomConfigResponseDto, 'isActive'>>;
type N_changedType = Equal<ZoomConfigResponseDto, Omit<ZoomConfigResponseDto, 'configured'> & { configured: string }>;
type N_optionality = Equal<ZoomTestResultDto, Omit<ZoomTestResultDto, 'error'> & { error: string }>;
type N_nullable = Equal<ProblemReportResponseDto, Omit<ProblemReportResponseDto, 'resolution'> & { resolution: string }>;
type N_nested = Equal<OpsOverviewReportDto, Omit<OpsOverviewReportDto, 'topServices'> & { topServices: unknown[] }>;
type N_envelope = Equal<ProblemReportListResponseDto, { items: ProblemReportResponseDto[] }>;
type N_wrongRoute = Equal<Result<GetZoomConfigHandler, 'execute'>, ZoomTestResultDto>;
type N_leakedSecret = Equal<ZoomConfigResponseDto, ZoomConfigResponseDto & { zoomClientSecret: string }>;
type N_outboxStatus = Equal<OpsOutboxRetryResponseDto, Omit<OpsOutboxRetryResponseDto, 'status'> & { status: 'PENDING' }>;
export type ControlsReject = Expect<
  [
    N_extraKey, N_missingKey, N_changedType, N_optionality, N_nullable, N_nested, N_envelope,
    N_wrongRoute, N_leakedSecret, N_outboxStatus,
  ] extends [false, false, false, false, false, false, false, false, false, false] ? true : false
>;

// ── Schema-level shape assertions ──────────────────────────────────────────

async function buildSchemas(): Promise<Record<string, SchemaObject>> {
  const moduleRef = await Test.createTestingModule({}).compile();
  const app = moduleRef.createNestApplication();
  try {
    const document = SwaggerModule.createDocument(app, new DocumentBuilder().build(), {
      extraModels: [
        ProblemReportResponseDto,
        ProblemReportListResponseDto,
        PlatformIntegrationResponseDto,
        PlatformIntegrationListItemResponseDto,
        ZoomConfigResponseDto,
        ZoomTestResultDto,
        OpsActivityLogEntryDto,
        OpsActivityLogListResponseDto,
        OpsActivityLogUserDto,
        OpsOutboxFailedEventDto,
        OpsOutboxFailedEventListResponseDto,
        OpsOutboxRetryResponseDto,
        OpsOverviewReportDto,
        OpsRevenueReportDto,
        OpsBookingsReportDto,
        OpsClientsReportDto,
        OpsPractitionersReportDto,
        OpsPractitionerDetailReportDto,
        OpsServicesReportDto,
        OpsRatingsReportDto,
        OpsActivityReportDto,
        OpsPackageSalesReportDto,
        OpsPackageOutstandingCreditReportDto,
        OpsPackageConsumptionReportDto,
        OpsRefundedPackagesEventsReportDto,
        OpsRefundedPackagesLegacyReportDto,
      ],
    });
    return (document.components?.schemas ?? {}) as Record<string, SchemaObject>;
  } finally {
    await app.close();
  }
}

const sorted = (values: readonly string[] | undefined) => [...(values ?? [])].sort();

describe('platform / integrations / ops response schemas (output shape)', () => {
  it('documents the problem report row as the persisted model', async () => {
    const schema = (await buildSchemas()).ProblemReportResponseDto;
    expect(Object.keys(schema.properties ?? {}).sort()).toEqual(
      ['id', 'reporterId', 'type', 'title', 'description', 'status', 'resolution', 'createdAt', 'updatedAt'].sort(),
    );
    expect(sorted(schema.required)).toEqual(
      ['id', 'reporterId', 'type', 'title', 'description', 'status', 'resolution', 'createdAt', 'updatedAt'].sort(),
    );
    expect(schema.properties?.type).toMatchObject({ type: 'string', enum: ['BUG', 'FEATURE_REQUEST', 'OTHER'] });
    expect(schema.properties?.status).toMatchObject({
      type: 'string',
      enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
    });
    expect(schema.properties?.resolution).toMatchObject({ type: 'string', nullable: true });
    expect(schema.properties?.createdAt).toMatchObject({ type: 'string', format: 'date-time' });
  });

  it('documents the problem report list envelope with the canonical meta', async () => {
    const schemas = await buildSchemas();
    const list = schemas.ProblemReportListResponseDto;
    expect(sorted(list.required)).toEqual(['items', 'meta']);
    expect(list.properties?.items).toMatchObject({
      type: 'array',
      items: { $ref: '#/components/schemas/ProblemReportResponseDto' },
    });
    expect(list.properties?.meta).toMatchObject({ allOf: [{ $ref: '#/components/schemas/ListMetaDto' }] });
    expect(sorted(schemas.ListMetaDto.required)).toEqual(
      ['total', 'page', 'limit', 'totalPages', 'hasNextPage', 'hasPreviousPage'].sort(),
    );
  });

  it('documents the integration upsert row with an honest free-form config column', async () => {
    const schema = (await buildSchemas()).PlatformIntegrationResponseDto;
    expect(Object.keys(schema.properties ?? {}).sort()).toEqual(
      ['id', 'provider', 'config', 'isActive', 'createdAt', 'updatedAt'].sort(),
    );
    expect(sorted(schema.required)).toEqual(
      ['id', 'provider', 'config', 'isActive', 'createdAt', 'updatedAt'].sort(),
    );
    // The config column is Prisma Json: it must stay a union, not a fake object.
    expect(schema.properties?.config).toMatchObject({ oneOf: expect.any(Array) });
    expect(schema.properties?.config).not.toHaveProperty('type');
    expect(schema.properties?.config).not.toHaveProperty('properties');
  });

  it('documents the integration list without the config column', async () => {
    const schema = (await buildSchemas()).PlatformIntegrationListItemResponseDto;
    expect(Object.keys(schema.properties ?? {}).sort()).toEqual(
      ['id', 'provider', 'isActive', 'hasConfig', 'createdAt', 'updatedAt'].sort(),
    );
    expect(schema.properties?.config).toBeUndefined();
    expect(schema.properties?.hasConfig).toMatchObject({ type: 'boolean' });
  });

  it('documents the Zoom view as two booleans and nothing secret', async () => {
    const schemas = await buildSchemas();
    const view = schemas.ZoomConfigResponseDto;
    expect(Object.keys(view.properties ?? {}).sort()).toEqual(['configured', 'isActive']);
    expect(sorted(view.required)).toEqual(['configured', 'isActive']);
    expect(view.properties?.configured).toMatchObject({ type: 'boolean' });
    expect(view.properties?.isActive).toMatchObject({ type: 'boolean' });
    const test = schemas.ZoomTestResultDto;
    expect(sorted(test.required)).toEqual(['ok']);
    expect(test.properties?.error).toMatchObject({ type: 'string' });
    for (const schema of [view, test]) {
      for (const key of ['zoomClientId', 'zoomClientSecret', 'zoomAccountId', 'config', 'ciphertext']) {
        expect(schema.properties?.[key]).toBeUndefined();
      }
    }
  });

  it('documents the activity log entry exactly as the handler projects it', async () => {
    const schemas = await buildSchemas();
    const entry = schemas.OpsActivityLogEntryDto;
    expect(Object.keys(entry.properties ?? {}).sort()).toEqual(
      [
        'id', 'userId', 'action', 'module', 'resourceId', 'description',
        'ipAddress', 'userAgent', 'createdAt', 'userEmail', 'user',
      ].sort(),
    );
    expect(sorted(entry.required)).toEqual(
      [
        'id', 'userId', 'action', 'module', 'resourceId', 'description',
        'ipAddress', 'userAgent', 'createdAt', 'userEmail', 'user',
      ].sort(),
    );
    expect(entry.properties?.action).toMatchObject({
      type: 'string',
      enum: ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'EXPORT', 'IMPORT', 'SYSTEM'],
    });
    expect(entry.properties?.module).toMatchObject({ type: 'string' });
    for (const key of ['userId', 'resourceId', 'ipAddress', 'userAgent', 'userEmail']) {
      expect(entry.properties?.[key]).toMatchObject({ type: 'string', nullable: true });
    }
    expect(entry.properties?.user).toMatchObject({ allOf: [{ $ref: '#/components/schemas/OpsActivityLogUserDto' }], nullable: true });
    expect(sorted(schemas.OpsActivityLogListResponseDto.required)).toEqual(['items', 'meta']);
  });

  it('documents the failed-outbox list as metadata only', async () => {
    const schemas = await buildSchemas();
    const item = schemas.OpsOutboxFailedEventDto;
    expect(Object.keys(item.properties ?? {}).sort()).toEqual(
      ['id', 'eventType', 'attemptCount', 'createdAt', 'failedAt', 'failureReason'].sort(),
    );
    expect(item.properties?.payload).toBeUndefined();
    expect(item.properties?.attemptCount).toMatchObject({ type: 'number' });
    expect(sorted(schemas.OpsOutboxFailedEventListResponseDto.required)).toEqual(['items']);
  });

  it('documents the outbox retry status as the durable lane it was reset to', async () => {
    const schemas = await buildSchemas();
    const retry = schemas.OpsOutboxRetryResponseDto;
    expect(retry.properties?.status).toMatchObject({ type: 'string', enum: ['PENDING', 'PENDING_V2'] });
    expect(sorted(retry.required)).toEqual(
      ['id', 'eventType', 'attemptCount', 'createdAt', 'failedAt', 'failureReason', 'status'].sort(),
    );
    // Widen-only: the retry shape keeps every failed-row key.
    expect(sorted(schemas.OpsOutboxFailedEventDto.required)).toEqual(
      ['id', 'eventType', 'attemptCount', 'createdAt', 'failedAt', 'failureReason'].sort(),
    );
  });

  it('documents the generated-report union with a binary alternative', async () => {
    const schemas = await buildSchemas();
    expect(OPS_GENERATED_REPORT_SCHEMA.oneOf).toHaveLength(9);
    const refs = OPS_GENERATED_REPORT_SCHEMA.oneOf.map((entry: { $ref: string }) => entry.$ref);
    for (const name of [
      'OpsOverviewReportDto', 'OpsRevenueReportDto', 'OpsBookingsReportDto', 'OpsClientsReportDto',
      'OpsPractitionersReportDto', 'OpsPractitionerDetailReportDto', 'OpsServicesReportDto',
      'OpsRatingsReportDto', 'OpsActivityReportDto',
    ]) {
      expect(refs).toContain(`#/components/schemas/${name}`);
      expect(schemas[name]).toBeDefined();
    }
    // Each branch keeps `previous` optional rather than required or banned.
    for (const name of ['OpsOverviewReportDto', 'OpsRevenueReportDto', 'OpsBookingsReportDto']) {
      expect(sorted(schemas[name].required)).not.toContain('previous');
      expect(schemas[name].properties?.previous).toBeDefined();
    }
    expect(schemas.OpsActivityReportDto.properties?.previous).toBeUndefined();
    // ACTIVITY documents all four top-level fields as required.
    expect(sorted(schemas.OpsActivityReportDto.required)).toEqual(['byDay', 'byUser', 'period', 'summary']);
  });

  it('documents the package-report union discriminated by kind', async () => {
    const schemas = await buildSchemas();
    expect(OPS_PACKAGE_REPORT_SCHEMA.oneOf).toHaveLength(5);
    expect(schemas.OpsPackageSalesReportDto.properties?.kind).toMatchObject({ type: 'string', enum: ['SALES'] });
    expect(schemas.OpsPackageOutstandingCreditReportDto.properties?.kind).toMatchObject({
      type: 'string',
      enum: ['OUTSTANDING_CREDIT'],
    });
    expect(schemas.OpsPackageConsumptionReportDto.properties?.kind).toMatchObject({
      type: 'string',
      enum: ['CONSUMPTION'],
    });
    expect(schemas.OpsPackageConsumptionReportDto.properties?.byEmployee).toMatchObject({
      type: 'array',
      items: { $ref: '#/components/schemas/OpsPackageConsumptionRowDto' },
    });
    expect(schemas.OpsRefundedPackagesEventsReportDto.properties?.historyMode).toMatchObject({
      type: 'string',
      enum: ['EVENTS'],
    });
    expect(schemas.OpsRefundedPackagesLegacyReportDto.properties?.historyMode).toMatchObject({
      type: 'string',
      enum: ['LEGACY'],
    });
    // Integer money, never floats: package amounts are documented as halalas.
    for (const key of ['grossRevenue', 'refundedAmount', 'netRevenue']) {
      expect(schemas.OpsPackageSalesReportDto.properties?.[key]).toMatchObject({ type: 'number' });
    }
  });
});
