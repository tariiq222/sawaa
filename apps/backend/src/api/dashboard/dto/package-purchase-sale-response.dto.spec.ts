import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import {
  PackagePurchaseSaleCreditDto,
  PackagePurchaseSaleResponseDto,
} from './finance-package-purchase-response.dto';
import type { CreatePackagePurchaseHandler } from '../../../modules/finance/package-purchases/create-package-purchase/create-package-purchase.handler';

// ── Compile-time proof against the INFERRED handler type ────────────────────
// The handler is not annotated with this DTO and does not import this layer.
type Expect<T extends true> = T;
type Result<T, M extends keyof T> = T[M] extends (...args: never[]) => Promise<infer R> ? R : never;
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
type Equal<A, B> = Extends<Norm<A>, Norm<B>> extends true ? Extends<Norm<B>, Norm<A>> : false;

/**
 * The handler's `purchase` is the raw Prisma row on both paths, and the replay
 * path types it with an index signature, so the DTO documents it as a free-form
 * object. This proves the envelope and every credit key are exact, and that
 * `purchase` accepts the real row.
 */
type HandlerResult = Result<CreatePackagePurchaseHandler, 'execute'>;
type PurchaseIsFreeForm = Expect<Extends<HandlerResult['purchase'], Record<string, unknown>>>;
type InvoiceIdIsString = Expect<Equal<HandlerResult['invoiceId'], string>>;
type PaymentIdIsNullableString = Expect<Equal<HandlerResult['paymentId'], string | null>>;
type CreditKeysMatch = Expect<
  Equal<
    { serviceId: unknown; employeeId: unknown; durationOptionId: unknown; unitPriceSnapshot: unknown; totalQuantity: unknown; usedQuantity: unknown; reservedQuantity: unknown },
    { [K in keyof HandlerResult['credits'][number] as K extends keyof PackagePurchaseSaleCreditDto ? K : never]: unknown }
  >
>;

// ── Negative controls: the helper rejects real drift ────────────────────────
type N_extraKey = Equal<PackagePurchaseSaleResponseDto & { extra: 1 }, PackagePurchaseSaleResponseDto>;
type N_missingKey = Equal<Omit<PackagePurchaseSaleResponseDto, 'credits'>, PackagePurchaseSaleResponseDto>;
type N_wrongType = Equal<Omit<PackagePurchaseSaleResponseDto, 'invoiceId'> & { invoiceId: number }, PackagePurchaseSaleResponseDto>;
type N_creditWrongType = Equal<Omit<PackagePurchaseSaleCreditDto, 'totalQuantity'> & { totalQuantity: string }, PackagePurchaseSaleCreditDto>;
export type R1 = Expect<N_extraKey extends false ? true : false>;
export type R2 = Expect<N_missingKey extends false ? true : false>;
export type R3 = Expect<N_wrongType extends false ? true : false>;
export type R4 = Expect<N_creditWrongType extends false ? true : false>;

// ── Schema-level assertions ─────────────────────────────────────────────────
async function buildSchemas(): Promise<Record<string, SchemaObject>> {
  const moduleRef = await Test.createTestingModule({}).compile();
  const app = moduleRef.createNestApplication();
  try {
    const document = SwaggerModule.createDocument(app, new DocumentBuilder().build(), {
      extraModels: [PackagePurchaseSaleResponseDto, PackagePurchaseSaleCreditDto],
    });
    return (document.components?.schemas ?? {}) as Record<string, SchemaObject>;
  } finally {
    await app.close();
  }
}

describe('package purchase sale response schema', () => {
  it('documents the envelope, the free-form purchase row and the credit snapshot', async () => {
    const schemas = await buildSchemas();
    const sale = schemas.PackagePurchaseSaleResponseDto;
    expect([...(sale.required ?? [])].sort()).toEqual(['credits', 'invoiceId', 'paymentId', 'purchase'].sort());
    expect(sale.properties?.purchase).toMatchObject({ type: 'object', additionalProperties: true });
    expect(sale.properties?.paymentId).toMatchObject({ type: 'string', nullable: true });
    expect(sale.properties?.credits).toMatchObject({ type: 'array' });

    const credit = schemas.PackagePurchaseSaleCreditDto;
    expect([...(credit.required ?? [])].sort()).toEqual(
      ['durationOptionId', 'employeeId', 'reservedQuantity', 'serviceId', 'totalQuantity', 'unitPriceSnapshot', 'usedQuantity'].sort(),
    );
    for (const key of ['unitPriceSnapshot', 'totalQuantity', 'usedQuantity', 'reservedQuantity']) {
      expect(credit.properties?.[key]).toMatchObject({ type: 'number' });
    }
    expect(credit.properties?.serviceId).toMatchObject({ type: 'string', nullable: true });
  });
});
