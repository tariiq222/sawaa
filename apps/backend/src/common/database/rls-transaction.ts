import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';

export interface RlsTransactionOptions {
  /** Prisma transaction timeout in ms. */
  timeout?: number;
  /** Prisma transaction maxWait in ms. */
  maxWait?: number;
  /** Postgres isolation level. */
  isolationLevel?: Prisma.TransactionIsolationLevel;
}

/**
 * Single-tenant transaction wrapper.
 *
 * Previously injected Postgres RLS GUCs (`app.current_org_id`,
 * `app.bypass_rls`). After the single-tenant migration dropped RLS policies
 * and helper functions, this is a thin Prisma `$transaction` wrapper kept
 * for API stability — callers do not need to change.
 */
@Injectable()
export class RlsTransactionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Run `fn` inside a Prisma transaction.
   *
   * In the legacy multi-tenant SaaS this also set `app.current_org_id`.
   * That GUC and the RLS policies that read it have been removed, so this
   * is now equivalent to `prisma.$transaction(fn, options)`.
   */
  async withTransaction<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
    options?: RlsTransactionOptions,
  ): Promise<T> {
    const txOptions: Parameters<typeof this.prisma.$transaction>[1] = {};
    if (options?.timeout !== undefined) txOptions.timeout = options.timeout;
    if (options?.maxWait !== undefined) txOptions.maxWait = options.maxWait;
    if (options?.isolationLevel !== undefined) txOptions.isolationLevel = options.isolationLevel;

    return this.prisma.$transaction(fn, txOptions);
  }

  /**
   * Alias for `withTransaction`. In the legacy SaaS this bypassed RLS;
   * with RLS removed both paths are identical.
   */
  async withBypassTransaction<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
    options?: Pick<RlsTransactionOptions, 'timeout' | 'maxWait' | 'isolationLevel'>,
  ): Promise<T> {
    return this.withTransaction(fn, options);
  }
}
