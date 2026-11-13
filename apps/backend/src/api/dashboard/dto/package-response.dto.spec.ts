import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import type {
  Prisma,
  SessionPackage,
  SessionPackageItem,
  SessionPackageItemConstraint,
  SessionPackageItemConstraintTarget,
} from '@prisma/client';
import {
  PackageConstraintTargetRecordDto,
  PackageDetailResponseDto,
  PackageFamilyOptionResponseDto,
  PackageFamilyResponseDto,
  PackageFamilyWithVatResponseDto,
  PackageGroupReadDto,
  PackageGroupedWriteResponseDto,
  PackageGroupSessionReadDto,
  PackageItemConstraintRecordDto,
  PackageItemRecordDto,
  PackageItemUnitPriceDto,
  PackageLegacyWriteResponseDto,
  PackageListRowDto,
  PackagePriceBreakdownDto,
  PackagePriceLineDto,
  PackageRawRecordDto,
  PaginatedPackagesDto,
} from './package-response.dto';
import type { ListSessionPackagesHandler } from '../../../modules/org-experience/session-packages/list-session-packages/list-session-packages.handler';
import type { GetSessionPackageHandler } from '../../../modules/org-experience/session-packages/get-session-package/get-session-package.handler';
import type { CreateSessionPackageHandler } from '../../../modules/org-experience/session-packages/create-session-package/create-session-package.handler';
import type { UpdateSessionPackageHandler } from '../../../modules/org-experience/session-packages/update-session-package/update-session-package.handler';
import type { ArchiveSessionPackageHandler } from '../../../modules/org-experience/session-packages/archive-session-package/archive-session-package.handler';
import type { ListPackageFamiliesHandler } from '../../../modules/org-experience/package-families/list-package-families/list-package-families.handler';
import type { GetPackageFamilyHandler } from '../../../modules/org-experience/package-families/get-package-family/get-package-family.handler';
import type { CreatePackageFamilyHandler } from '../../../modules/org-experience/package-families/create-package-family/create-package-family.handler';
import type { UpdatePackageFamilyHandler } from '../../../modules/org-experience/package-families/update-package-family/update-package-family.handler';
import type { ArchivePackageFamilyHandler } from '../../../modules/org-experience/package-families/archive-package-family/archive-package-family.handler';
import type { PackagePriceResult } from '../../../modules/org-experience/compute-package-price.service';
import type { ListMetaDto } from './people-response.dto';
import type { CreatedGroupedCatalogPackage } from '../../../modules/org-experience/session-packages/package-group-catalog.helper';
import { decorateGroupedPackage } from '../../../modules/org-experience/session-packages/package-group-catalog.helper';
import {
  decorateFamily,
  decorateFamilyOption,
} from '../../../modules/org-experience/package-families/package-family-catalog.helper';

// ── Compile-time exactness: DTO <=> INFERRED handler output ─────────────────
//
// No handler under src/modules is annotated with a return type and none imports
// from this layer. Every assertion below reads the handler's INFERRED return
// type, so it proves BOTH that the DTO covers what the handler really produces
// and that it documents nothing extra. The controller's `Promise<Dto>`
// annotation only proves the one-way assignability that these checks imply.
//
// The only modules-side type edits are Prisma-only (no api import): the two
// hand-written `Grouped{Write,Update}Transaction` stubs now name the exact
// Prisma payload their `include` returns instead of a narrow stub / `unknown`,
// `GroupedCatalogPackage.modelVersion` is `PackageModelVersion`, and
// `randomUUID()` ids are widened to `string` where they are returned as rows.

type Expect<T extends true> = T;
type Id<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Result<T, M extends keyof T> = T[M] extends (...args: never[]) => Promise<infer R> ? R : never;

/**
 * `Id<A, B>` alone is identity-only, and the handlers return INTERSECTION types
 * (`Row & { constraints: ... }`), which are not identity-equal to the flat DTO
 * even when every key and type matches. `Norm` flattens/rebuilds each object, so
 * `DeepEq` compares structure: same key set, same property types, recursively.
 * Four negative controls below prove it still rejects an extra key, a missing
 * key, a changed type and a changed optionality.
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

// ── Raw persisted rows ─────────────────────────────────────────────────────

type ItemWithConstraints = SessionPackageItem & {
  constraints: Array<SessionPackageItemConstraint & { targets: SessionPackageItemConstraintTarget[] }>;
};
export type ItemRecordMatchesPrisma = Expect<DeepEq<PackageItemRecordDto, ItemWithConstraints>>;
export type ConstraintRecordMatchesPrisma = Expect<
  DeepEq<PackageItemConstraintRecordDto, SessionPackageItemConstraint & { targets: SessionPackageItemConstraintTarget[] }>
>;
export type ConstraintTargetMatchesPrisma = Expect<
  DeepEq<PackageConstraintTargetRecordDto, SessionPackageItemConstraintTarget>
>;
export type RawRecordMatchesPrisma = Expect<DeepEq<PackageRawRecordDto, SessionPackage>>;

// ── Write payloads: the exact `include` each handler passes ────────────────

type ItemInclude = { include: { constraints: { include: { targets: true } } } };
type GroupedInclude = {
  items: ItemInclude;
  groups: { include: { items: ItemInclude } };
};

/**
 * LEGACY create branch: `create-session-package.handler.ts` →
 * `tx.sessionPackage.create({ …, include: { items: { include: { constraints:
 * { include: { targets: true } } } } } })`.
 * LEGACY update branch: `update-session-package.handler.ts` → the same include
 * on `tx.sessionPackage.update(...)`.
 */
type LegacyWritePayload = Prisma.SessionPackageGetPayload<{ include: { items: ItemInclude } }>;
export type LegacyWritePayloadMatchesDto = Expect<DeepEq<LegacyWritePayload, PackageLegacyWriteResponseDto>>;

/**
 * GROUPED create branch: `create-session-package.handler.ts` → the
 * `txAny.sessionPackage.findUnique({ …, include: { groups: { include: { items:
 * { include: { constraints: { include: { targets: true } } } } } }, items: {
 * include: { constraints: { include: { targets: true } } } } } })` call.
 * GROUPED update branch: `update-session-package.handler.ts` → the same include
 * on `txAny.sessionPackage.update(...)`. Both narrow `tx` through
 * `as unknown as Grouped{Write,Update}Transaction`, so their inferred return
 * type is the hand-written stub rather than Prisma's; Prisma is the source of
 * truth for the documented shape.
 */
type GroupedWritePayload = Prisma.SessionPackageGetPayload<{ include: GroupedInclude }>;
export type GroupedWritePayloadMatchesDto = Expect<DeepEq<GroupedWritePayload, PackageGroupedWriteResponseDto>>;

/**
 * `CreatedGroupedCatalogPackage` (the stub the grouped create branch casts to)
 * is NARROWER than the documented payload: it has `id` plus the optional
 * `modelVersion`/`discountType`/`discountValue`/`groups`/`items` of
 * `GroupedCatalogPackage`, and its `groups` are the editor projection
 * (`GroupedCatalogGroup`, with `sessions`) rather than the persisted rows. The
 * controller return type therefore cannot be asserted against the stub alone;
 * it is asserted against `LegacyWritePayload | GroupedWritePayload` instead, and
 * `ControllerCreateReturnMatchesDto` proves the controller annotation agrees.
 */
export type StubIsNotTheDocumentedShape = Expect<
  DeepEq<CreatedGroupedCatalogPackage, GroupedWritePayload> extends true ? false : true
>;

// ── Decorated read projections, taken from the real decorators ─────────────

type DecoratedFamily = Awaited<ReturnType<typeof decorateFamily>>;
type DecoratedFamilyOption = Awaited<ReturnType<typeof decorateFamilyOption>>;
export type FamilyReadMatchesDecorator = Expect<DeepEq<DecoratedFamily, PackageFamilyResponseDto>>;
export type FamilyOptionReadMatchesDecorator = Expect<
  DeepEq<DecoratedFamilyOption, PackageFamilyOptionResponseDto>
>;

// ── Price breakdown mirrors ComputePackagePriceService's result ─────────────

export type PriceMatchesCompute = Expect<DeepEq<PackagePriceResult, PackagePriceBreakdownDto>>;
export type PriceLineMatchesCompute = Expect<DeepEq<PackagePriceResult['lines'][number], PackagePriceLineDto>>;
export type ItemUnitPriceMatchesCompute = Expect<
  DeepEq<PackagePriceResult['itemUnitPrices'][number], PackageItemUnitPriceDto>
>;

type DecoratedGroups = ReturnType<typeof decorateGroupedPackage>['groups'];
export type GroupReadMatchesDecorator = Expect<DeepEq<PackageGroupReadDto, DecoratedGroups[number]>>;
export type GroupSessionMatchesDecorator = Expect<
  DeepEq<PackageGroupSessionReadDto, DecoratedGroups[number]['sessions'][number]>
>;

// ── Every in-scope route, against its INFERRED handler type ────────────────

export type ListPackagesMatches = Expect<DeepEq<Result<ListSessionPackagesHandler, 'execute'>, PaginatedPackagesDto>>;
export type GetPackageMatches = Expect<DeepEq<Result<GetSessionPackageHandler, 'execute'>, PackageDetailResponseDto>>;
export type ArchivePackageMatches = Expect<DeepEq<Result<ArchiveSessionPackageHandler, 'execute'>, { id: string }>>;
export type ListFamiliesMatches = Expect<
  DeepEq<Result<ListPackageFamiliesHandler, 'execute'>, PackageFamilyWithVatResponseDto[]>
>;
export type GetFamilyMatches = Expect<DeepEq<Result<GetPackageFamilyHandler, 'execute'>, PackageFamilyResponseDto>>;
export type UpdateFamilyMatches = Expect<
  DeepEq<Result<UpdatePackageFamilyHandler, 'execute'>, Prisma.PackageFamilyGetPayload<object>>
>;
export type ArchiveFamilyMatches = Expect<DeepEq<Result<ArchivePackageFamilyHandler, 'execute'>, void>>;

/**
 * Create/update pass `tx` through the hand-written
 * `Grouped{Write,Update}Transaction` stubs. Those stubs are now declared with
 * the Prisma payload of the same `include` the handlers pass, so the grouped
 * branch contributes the real row instead of `CreatedGroupedCatalogPackage`
 * (a narrow stub: `id` + optional columns, editor-projection groups) or
 * `unknown`.
 *
 * Prisma types the grouped payload as `LegacyWritePayload & { groups: … }`
 * (an intersection), so `GroupedWritePayload | LegacyWritePayload` reduces to
 * `LegacyWritePayload` — which is why both routes infer exactly that type.
 */
export type CreatePackageInferred = Expect<
  DeepEq<Result<CreateSessionPackageHandler, 'execute'>, LegacyWritePayload>
>;
export type UpdatePackageInferred = Expect<
  DeepEq<Result<UpdateSessionPackageHandler, 'execute'>, LegacyWritePayload>
>;
/** The grouped payload really is the legacy payload plus `groups` (hence the reduction). */
export type GroupedPayloadExtendsLegacy = Expect<
  [GroupedWritePayload] extends [LegacyWritePayload] ? true : false
>;
/** POST/PATCH document the two real payloads; the DTO union equals Prisma's. */
export type WriteUnionMatchesPrisma = Expect<
  DeepEq<PackageLegacyWriteResponseDto | PackageGroupedWriteResponseDto, LegacyWritePayload | GroupedWritePayload>
>;

/** Family create returns the minimal persisted family row plus the written options. */
type FamilyRow = Prisma.PackageFamilyGetPayload<object>;
type WrittenFamilyOption = {
  id: string;
  familyId: string;
  archivedAt: null;
  modelVersion: 'GROUPED_V2';
  ownerEmployeeId: null;
  nameAr: string;
  nameEn: string | null;
  descriptionAr: null;
  descriptionEn: null;
  imageUrl: null;
  iconName: null;
  iconBgColor: null;
  discountType: 'PERCENTAGE' | 'FIXED';
  discountValue: number;
  isActive: boolean;
  isPublic: boolean;
  sortOrder: number;
  groups: Array<{
    id: string;
    key: string;
    label: string | null;
    serviceId: string;
    employeeId: string;
    sequenceMode: 'ORDERED' | 'UNORDERED';
    sortOrder: number;
    items: Array<{
      key: string;
      position: number;
      durationOptionId: string;
      deliveryType: 'IN_PERSON' | 'ONLINE';
      unitPrice: number;
      durationMins: number;
      listPrice: number;
      effectivePrice: number;
      serviceName: string;
      employeeName: string;
    }>;
  }>;
};
export type CreateFamilyMatches = Expect<
  DeepEq<Result<CreatePackageFamilyHandler, 'execute'>, FamilyRow & { options: WrittenFamilyOption[] }>
>;

// ── Negative controls: the DeepEq above is not vacuous ─────────────────────

type ListRow = Result<ListSessionPackagesHandler, 'execute'>['items'][number];
type NestedBadRow = Omit<PackageListRowDto, 'items'> & {
  items: Array<Omit<PackageItemRecordDto, 'paidQuantity'>>;
};
export type N_extraKey = DeepEq<ListRow, PackageListRowDto & { extra: 1 }>;
export type N_missingKey = DeepEq<ListRow, Omit<PackageListRowDto, 'vatRate'>>;
export type N_changedType = DeepEq<ListRow, Omit<PackageListRowDto, 'vatRate'> & { vatRate: string }>;
export type N_optionality = DeepEq<ListRow, Omit<PackageListRowDto, 'vatRate'> & { vatRate?: number }>;
/** Nested: a missing array-item field, two levels down. */
export type N_nestedMissing = DeepEq<ListRow, NestedBadRow>;
/** Nested: a changed type inside `groups[].sessions[]`. */
type DeepBadGroup = Omit<PackageGroupReadDto, 'sessions'> & {
  sessions: Array<Omit<PackageGroupSessionReadDto, 'unitPrice'> & { unitPrice: string }>;
};
export type N_nestedType = DeepEq<ListRow['groups'][number], DeepBadGroup>;
export type ControlsReject = Expect<
  [N_extraKey, N_missingKey, N_changedType, N_optionality, N_nestedMissing, N_nestedType] extends
    [false, false, false, false, false, false] ? true : false
>;

// ── Schema-level shape assertions ──────────────────────────────────────────

async function buildSchemas(): Promise<Record<string, SchemaObject>> {
  const moduleRef = await Test.createTestingModule({}).compile();
  const app = moduleRef.createNestApplication();
  try {
    const document = SwaggerModule.createDocument(app, new DocumentBuilder().build(), {
      extraModels: [
        PackageDetailResponseDto,
        PackageListRowDto,
        PaginatedPackagesDto,
        PackageLegacyWriteResponseDto,
        PackageGroupedWriteResponseDto,
        PackageFamilyResponseDto,
        PackageFamilyWithVatResponseDto,
        PackageFamilyOptionResponseDto,
        PackagePriceBreakdownDto,
      ],
    });
    return (document.components?.schemas ?? {}) as Record<string, SchemaObject>;
  } finally {
    await app.close();
  }
}

describe('package response schemas (output shape)', () => {
  it('the list wrapper documents its item and meta members', async () => {
    const schema = (await buildSchemas()).PaginatedPackagesDto;
    expect(schema.properties?.items).toMatchObject({
      type: 'array',
      items: { $ref: '#/components/schemas/PackageListRowDto' },
    });
    expect(schema.properties?.meta).toMatchObject({ allOf: [{ $ref: '#/components/schemas/ListMetaDto' }] });
  });

  it('list rows carry the flattened price and the detail carries a breakdown', async () => {
    const schemas = await buildSchemas();
    // Money is integer halalas; vatRate is a fraction, so it stays `number`.
    for (const key of ['subtotal', 'discountAmount', 'finalPrice', 'fullValue', 'freeValue']) {
      expect(schemas.PackageListRowDto.properties?.[key]).toMatchObject({ type: 'integer' });
    }
    expect(schemas.PackageListRowDto.properties?.vatRate).toMatchObject({ type: 'number' });
    expect(schemas.PackageDetailResponseDto.properties?.price).toMatchObject({
      allOf: [{ $ref: '#/components/schemas/PackagePriceBreakdownDto' }],
    });
    expect(schemas.PackageDetailResponseDto.required).toContain('price');
  });

  it('money that arrives as a Prisma Decimal stays a decimal string, never a number', async () => {
    const schemas = await buildSchemas();
    expect(schemas.PackageLegacyWriteResponseDto.properties?.discountValue).toMatchObject({ type: 'string' });
    expect(schemas.PackageDetailResponseDto.properties?.discountValue).toMatchObject({ type: 'string' });
    expect(schemas.PackagePriceBreakdownDto.properties?.finalPrice).toMatchObject({ type: 'integer' });
  });

  it('write responses document the raw row, and either legacy items or grouped groups', async () => {
    const schemas = await buildSchemas();
    expect(schemas.PackageLegacyWriteResponseDto.properties?.items).toMatchObject({
      type: 'array',
      items: { $ref: '#/components/schemas/PackageItemRecordDto' },
    });
    expect(schemas.PackageLegacyWriteResponseDto.properties?.groups).toBeUndefined();
    expect(schemas.PackageGroupedWriteResponseDto.properties?.groups).toMatchObject({
      type: 'array',
      items: { $ref: '#/components/schemas/PackageRawGroupRecordDto' },
    });
  });

  it('package families document a standalone flag, options, and the optional display labels', async () => {
    const schemas = await buildSchemas();
    expect(schemas.PackageFamilyResponseDto.required).toEqual(
      expect.arrayContaining(['id', 'nameAr', 'isStandalone', 'options', 'archivedAt', 'createdAt', 'updatedAt']),
    );
    expect(schemas.PackageFamilyOptionResponseDto.properties?.displayGroups).toMatchObject({
      type: 'array',
      items: { $ref: '#/components/schemas/PackageDisplayGroupDto' },
    });
    expect((schemas.PackageFamilyOptionResponseDto.required ?? []).includes('displayGroups')).toBe(false);
    expect(schemas.PackageFamilyWithVatResponseDto.properties?.vatRate).toMatchObject({ type: 'number' });
  });

  it('the paginated meta is the shared ListMetaDto', async () => {
    const schemas = await buildSchemas();
    const meta = schemas.PaginatedPackagesDto.properties?.meta as { allOf?: Array<{ $ref: string }> };
    expect(meta.allOf?.[0].$ref).toBe('#/components/schemas/ListMetaDto');
    const expected: ListMetaDto['total'] = 1;
    void expected;
  });
});
