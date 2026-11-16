import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import {
  NotificationDeliveryLogRecordDto,
  NotificationDeliveryLogListMetaDto,
  PaginatedNotificationDeliveryLogsDto,
} from './notification-delivery-log-response.dto';
import type { ListTenantDeliveryLogsHandler } from '../../../modules/comms/list-tenant-delivery-logs/list-tenant-delivery-logs.handler';

// ── Compile-time exactness: DTO <=> INFERRED handler output ─────────────────
//
// The handler is NOT annotated with this DTO and does not import this layer
// (`git grep -l "api/dashboard/dto" -- apps/backend/src/modules` is empty), so
// each assertion below proves the documented response is exactly what the
// handler returns.

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
type Equal<A, B> = Extends<Norm<A>, Norm<B>> extends true
  ? Extends<Norm<B>, Norm<A>>
  : false;

/** `GET /dashboard/comms/delivery-logs` returns `{ items, meta }`. */
export type ListDeliveryLogsMatches = Expect<
  Equal<Result<ListTenantDeliveryLogsHandler, 'execute'>, PaginatedNotificationDeliveryLogsDto>
>;

// ── Negative controls: the equality helper must reject real drift ───────────

type RowWithExtra = NotificationDeliveryLogRecordDto & { jobId: string };
type PaginatedWithExtraRow = Omit<PaginatedNotificationDeliveryLogsDto, 'items'> & {
  items: RowWithExtra[];
};
type PaginatedMissingRow = Omit<PaginatedNotificationDeliveryLogsDto, 'items'> & {
  items: Omit<NotificationDeliveryLogRecordDto, 'attempts'>[];
};
type PaginatedWrongAttempts = Omit<PaginatedNotificationDeliveryLogsDto, 'items'> & {
  items: Array<Omit<NotificationDeliveryLogRecordDto, 'attempts'> & { attempts: string }>;
};
type MetaMissingTotal = Omit<PaginatedNotificationDeliveryLogsDto, 'meta'> & {
  meta: Omit<NotificationDeliveryLogListMetaDto, 'total'>;
};

export type ExtraRowIsRejected = Expect<
  Equal<PaginatedWithExtraRow, PaginatedNotificationDeliveryLogsDto> extends false ? true : false
>;
export type MissingRowIsRejected = Expect<
  Equal<PaginatedMissingRow, PaginatedNotificationDeliveryLogsDto> extends false ? true : false
>;
export type WrongTypeIsRejected = Expect<
  Equal<PaginatedWrongAttempts, PaginatedNotificationDeliveryLogsDto> extends false ? true : false
>;
export type MissingMetaIsRejected = Expect<
  Equal<MetaMissingTotal, PaginatedNotificationDeliveryLogsDto> extends false ? true : false
>;

// ── Schema-level shape assertions ──────────────────────────────────────────

async function buildSchemas(): Promise<Record<string, SchemaObject>> {
  const moduleRef = await Test.createTestingModule({}).compile();
  const app = moduleRef.createNestApplication();
  try {
    const document = SwaggerModule.createDocument(app, new DocumentBuilder().build(), {
      extraModels: [
        NotificationDeliveryLogRecordDto,
        NotificationDeliveryLogListMetaDto,
        PaginatedNotificationDeliveryLogsDto,
      ],
    });
    return (document.components?.schemas ?? {}) as Record<string, SchemaObject>;
  } finally {
    await app.close();
  }
}

describe('notification delivery log response schema', () => {
  it('documents exactly the projected row keys, with enums and nullable columns', async () => {
    const schema = (await buildSchemas()).NotificationDeliveryLogRecordDto;
    // The handler projects 14 columns; `jobId`/`updatedAt` exist on the model
    // but are deliberately NOT selected, so they must not be documented.
    expect([...(schema.required ?? [])].sort()).toEqual(
      [
        'id', 'recipientId', 'type', 'priority', 'channel', 'status', 'senderActor',
        'toAddress', 'providerName', 'attempts', 'lastAttemptAt', 'sentAt',
        'errorMessage', 'createdAt',
      ].sort(),
    );
    expect(Object.keys(schema.properties ?? {}).sort()).toEqual(
      [
        'id', 'recipientId', 'type', 'priority', 'channel', 'status', 'senderActor',
        'toAddress', 'providerName', 'attempts', 'lastAttemptAt', 'sentAt',
        'errorMessage', 'createdAt',
      ].sort(),
    );
    expect(schema.properties?.attempts).toMatchObject({ type: 'integer' });
    expect(schema.properties?.channel).toMatchObject({ type: 'string' });
    expect(schema.properties?.status).toMatchObject({ type: 'string' });
    expect(schema.properties?.toAddress).toMatchObject({ type: 'string', nullable: true });
    expect(schema.properties?.sentAt).toMatchObject({ type: 'string', format: 'date-time', nullable: true });
  });

  it('documents the pagination envelope as items + meta with integer counters', async () => {
    const schemas = await buildSchemas();
    const page = schemas.PaginatedNotificationDeliveryLogsDto;
    expect([...(page.required ?? [])].sort()).toEqual(['items', 'meta'].sort());
    const meta = schemas.NotificationDeliveryLogListMetaDto;
    expect([...(meta.required ?? [])].sort()).toEqual(['page', 'limit', 'total', 'totalPages'].sort());
    for (const key of ['page', 'limit', 'total', 'totalPages']) {
      expect(meta.properties?.[key]).toMatchObject({ type: 'integer' });
    }
  });
});
