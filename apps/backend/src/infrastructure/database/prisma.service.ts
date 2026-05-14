import { ForbiddenException, Injectable, Logger, Optional, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import {
  REQUEST_TX_CLS_KEY,
  SUPER_ADMIN_CONTEXT_CLS_KEY,
} from '../../common/tenant/tenant.constants';
import { TenantContextService } from '../../common/tenant/tenant-context.service';

/**
 * Single PrismaClient instance shared across all Bounded Contexts.
 *
 * Why a Proxy instead of `Object.assign(this, extended)`?
 * - In Prisma 7, `$extends` returns a different runtime client whose model
 *   accessors use internal proxy traps. Copying those traps onto `this` with
 *   Object.assign silently drops fields and produces subtle bugs at query time.
 * - A Proxy preserves the full extended client (including its traps) while
 *   keeping `PrismaService` a `PrismaClient` subclass for DI and types.
 * - Callers that read `prisma.user.findMany(...)` transparently hit the
 *   extended client's hooks, which is exactly what we want.
 *
 * Single-tenant: no automatic organizationId scoping. Every handler is
 * responsible for passing the correct organizationId explicitly.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readonly basePrisma: PrismaClient;
  private readonly extended: PrismaClient;

  constructor(
    // `@Optional()` lets isolated test modules instantiate PrismaService
    // without wiring ConfigModule/TenantModule. In prod both are global and
    // always present — the optionals are only for narrow unit-test fixtures.
    @Optional() private readonly config?: ConfigService,
    @Optional() private readonly cls?: ClsService,
    @Optional() private readonly tenantCtx?: TenantContextService,
  ) {
    super({
      adapter: new PrismaPg({
        connectionString: process.env.DATABASE_URL,
        max: 25,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 10_000,
      }),
    });
    this.basePrisma = this as unknown as PrismaClient;
    this.extended = this.basePrisma;

    // Proxy reads for model accessors and $-methods go to the extended client;
    // lifecycle + internal fields stay on the base class.
    const self = this;
    return new Proxy(this, {
      get(target, prop, receiver) {
        if (
          prop === 'onModuleInit' ||
          prop === 'onModuleDestroy' ||
          prop === 'logger' ||
          prop === 'config' ||
          prop === 'cls' ||
          prop === 'tenantCtx' ||
          prop === 'basePrisma' ||
          prop === 'extended' ||
          prop === '$allTenants' ||
          prop === '$connect' ||
          prop === '$disconnect'
        ) {
          return Reflect.get(target, prop, receiver);
        }
        // CLS-pinned transaction routing: when a request interceptor wrapped
        // this request in a transaction, route model accessors through the pinned
        // tx so every query reuses the same connection.
        // Skip $-prefixed methods and well-known internal symbols -- those are the
        // orchestration API of PrismaClient itself, not model accessors.
        if (
          typeof prop === 'string' &&
          !prop.startsWith('$') &&
          !prop.startsWith('_') &&
          prop !== 'then' &&
          prop !== 'catch' &&
          prop !== 'finally' &&
          prop !== 'constructor'
        ) {
          const tx = self.cls?.get<Prisma.TransactionClient | undefined>(
            REQUEST_TX_CLS_KEY,
          );
          if (tx) {
            const modelOnTx = Reflect.get(tx as object, prop);
            if (modelOnTx !== undefined) return modelOnTx;
          }
        }

        const fromExtended = Reflect.get(self.extended as object, prop);
        if (typeof fromExtended === 'function') {
          return (fromExtended as (...args: unknown[]) => unknown).bind(self.extended);
        }
        return fromExtended ?? Reflect.get(target, prop, receiver);
      },
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Prisma connected (single-tenant)');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Prisma disconnected');
  }

  get $allTenants(): PrismaClient {
    if (this.cls?.get<boolean | undefined>(SUPER_ADMIN_CONTEXT_CLS_KEY) !== true) {
      throw new ForbiddenException('super_admin_context_required');
    }
    return this.basePrisma;
  }
}
