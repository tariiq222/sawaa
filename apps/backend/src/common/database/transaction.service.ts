import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';

export interface TransactionOptions {
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
 * A thin wrapper over Prisma `$transaction`: all application code runs its
 * transactions through this one service. (It was previously named
 * `RlsTransactionService` and injected Postgres RLS GUCs; RLS policies and
 * helper functions were dropped in the single-tenant migration.)
 */
@Injectable()
export class TransactionService {
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
    options?: TransactionOptions,
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
    options?: Pick<TransactionOptions, 'timeout' | 'maxWait' | 'isolationLevel'>,
  ): Promise<T> {
    return this.withTransaction(fn, options);
  }
}
