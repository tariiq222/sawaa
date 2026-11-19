import type { Prisma, PrismaClient } from '@prisma/client';

/**
 * Typed PrismaClient test double.
 *
 * Only the model operations a spec explicitly configures exist. Every other
 * model access or operation returns a Jest mock that throws
 * `unexpected Prisma call: <model>.<method>` when invoked. That intentional
 * failure catches specs that accidentally depend on an undefined mock instead
 * of declaring the database interaction they exercise.
 *
 * Method names are checked against the generated Prisma client, so
 * `createPrismaMock({ booking: { findFirsts: ... } })` is a compile error.
 */

/** Exactly the model accessors that exist on PrismaClient (`booking`, `payment`, …). */
type PrismaModelName = Prisma.TypeMap['meta']['modelProps'];

type PrismaDelegate<K extends PrismaModelName> = PrismaClient[K];

type PrismaOperationName<K extends PrismaModelName> = {
  [M in keyof PrismaDelegate<K>]: PrismaDelegate<K>[M] extends (...args: any[]) => any ? M : never;
}[keyof PrismaDelegate<K>] & string;

type PrismaOperationResult<K extends PrismaModelName, M extends PrismaOperationName<K>> =
  PrismaDelegate<K>[M] extends (...args: any[]) => infer R ? Awaited<R> : never;

/**
 * Test fixtures routinely model only the columns a handler reads and add the
 * included relations the handler asked for. Base column types are still
 * checked against the real Prisma result; extra keys cover `include`/`select`
 * shapes and partial rows.
 */
type MockRow<T> = Partial<T> & Record<string, unknown>;

type MockResult<R> =
  R extends null ? R
  : R extends (infer T)[] ? Array<MockRow<T>>
  : R extends object ? MockRow<R>
  : R;

/** A fixture value, a partial row, or a fully custom Jest mock for one operation. */
export type PrismaMockOverride<K extends PrismaModelName, M extends PrismaOperationName<K>> =
  | MockResult<PrismaOperationResult<K, M>>
  | jest.Mock;

export type PrismaMockConfig = {
  [K in PrismaModelName]?: {
    [M in PrismaOperationName<K>]?: PrismaMockOverride<K, M>;
  };
};

export interface PrismaMockExtras {
  /** Default: invoke the callback with the mock, or `Promise.all` the array form. */
  $transaction?: jest.Mock;
  /** Default: throw `unexpected Prisma call: $queryRaw`. */
  $queryRaw?: jest.Mock | unknown;
  /** Default: throw `unexpected Prisma call: $executeRaw`. */
  $executeRaw?: jest.Mock | unknown;
}

type ModelMock<K extends PrismaModelName> = {
  [M in PrismaOperationName<K>]: jest.Mock;
};

export type PrismaMock = {
  [K in PrismaModelName]: ModelMock<K>;
} & {
  $transaction: jest.Mock;
  $queryRaw: jest.Mock;
  $executeRaw: jest.Mock;
};

const unexpected = (path: string): Error =>
  new Error(`unexpected Prisma call: ${path}`);

const toMock = (path: string, value: unknown): jest.Mock => {
  if (jest.isMockFunction(value)) return value as jest.Mock;
  return jest.fn().mockResolvedValue(value);
};

const throwingMock = (path: string): jest.Mock =>
  jest.fn(() => {
    throw unexpected(path);
  });

const isAwaited = (property: string): boolean =>
  property === 'then' || property === 'catch' || property === 'finally' || property === 'toJSON';

const isObjectProtocol = (property: string): boolean =>
  property === 'constructor' ||
  property === 'toString' ||
  property === 'valueOf' ||
  property === 'hasOwnProperty' ||
  property === 'inspect';

/**
 * Build a strict, typed Prisma mock.
 *
 * @example
 * const prisma = createPrismaMock({
 *   booking: { findFirst: buildBooking({ id: 'booking-1' }) },
 * });
 * prisma.booking.findFirst.mockResolvedValue(null); // typed Jest mock
 */
export function createPrismaMock(
  config: PrismaMockConfig = {},
  extras: PrismaMockExtras = {},
): PrismaMock {
  const configuredModels = new Map<string, Record<string, jest.Mock>>();

  for (const [modelName, operations] of Object.entries(config)) {
    if (!operations) continue;
    const configured: Record<string, jest.Mock> = {};
    for (const [methodName, value] of Object.entries(operations)) {
      configured[methodName] = toMock(`${modelName}.${methodName}`, value);
    }
    configuredModels.set(modelName, configured);
  }

  const modelProxies = new Map<string, Record<string, jest.Mock>>();
  const modelProxy = (modelName: string): Record<string, jest.Mock> => {
    const cached = modelProxies.get(modelName);
    if (cached) return cached;
    const configured = configuredModels.get(modelName) ?? {};
    const unexpectedOperations = new Map<string, jest.Mock>();
    const proxy = new Proxy(configured, {
      get(target, property, receiver) {
        if (typeof property !== 'string') return Reflect.get(target, property, receiver);
        if (isAwaited(property) || isObjectProtocol(property)) {
          return Reflect.get(target, property, receiver);
        }
        if (property in target) return target[property];
        if (!unexpectedOperations.has(property)) {
          unexpectedOperations.set(property, throwingMock(`${modelName}.${property}`));
        }
        return unexpectedOperations.get(property);
      },
    });
    modelProxies.set(modelName, proxy);
    return proxy;
  };

  const transaction = extras.$transaction ?? jest.fn(
    (arg: Promise<unknown>[] | ((tx: unknown) => Promise<unknown>)) =>
      (typeof arg === 'function' ? arg(mock) : Promise.all(arg)),
  );

  const extrasTarget: Record<string, unknown> = {
    $transaction: transaction,
    $queryRaw: toMock('$queryRaw', extras.$queryRaw ?? throwingMock('$queryRaw')),
    $executeRaw: toMock('$executeRaw', extras.$executeRaw ?? throwingMock('$executeRaw')),
  };

  const mock = new Proxy(extrasTarget, {
    get(target, property, receiver) {
      if (typeof property !== 'string') return Reflect.get(target, property, receiver);
      if (isAwaited(property) || isObjectProtocol(property)) {
        return Reflect.get(target, property, receiver);
      }
      if (property in target) {
        const value = target[property];
        if (typeof value === 'function' && !jest.isMockFunction(value)) {
          return (value as (...args: unknown[]) => unknown).bind(target);
        }
        return value;
      }
      // Unknown `$` methods and model names both fail loudly when invoked.
      if (property.startsWith('$')) return throwingMock(property);
      return modelProxy(property);
    },
  }) as unknown as PrismaMock;

  return mock;
}
