import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  type ClientAccountStore,
  type ClientAuthView,
  type NewRegisteredClient,
} from '../../../common/contracts/client-account.contract';

const CLIENT_AUTH_SELECT = {
  id: true,
  userId: true,
  email: true,
  emailVerified: true,
  phone: true,
  phoneVerified: true,
  passwordHash: true,
  tokenVersion: true,
  isActive: true,
  deletedAt: true,
  loginAttempts: true,
  lockoutUntil: true,
  lastLoginAt: true,
} satisfies Prisma.ClientSelect;

type ClientAuthRow = Prisma.ClientGetPayload<{ select: typeof CLIENT_AUTH_SELECT }>;

/**
 * `people`-owned implementation of the client account contract (ADR-002).
 *
 * Every method takes the caller's transaction and performs exactly one kind of
 * write. No method opens a transaction, reads outside the caller's `tx`, or
 * accepts an arbitrary Prisma update object.
 */
@Injectable()
export class PgClientAccountStore implements ClientAccountStore {
  async findByIdentifier(
    tx: Prisma.TransactionClient,
    by: { email: string } | { phone: string },
  ): Promise<ClientAuthView | null> {
    const row = await tx.client.findFirst({
      where: { ...by, deletedAt: null },
      select: CLIENT_AUTH_SELECT,
    });
    return row ? toView(row) : null;
  }

  async lockForAuth(
    tx: Prisma.TransactionClient,
    clientId: string,
  ): Promise<ClientAuthView | null> {
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "Client" WHERE "id" = ${clientId} FOR UPDATE`,
    );
    const row = await tx.client.findUnique({
      where: { id: clientId },
      select: CLIENT_AUTH_SELECT,
    });
    return row ? toView(row) : null;
  }

  async createRegisteredClient(
    tx: Prisma.TransactionClient,
    input: NewRegisteredClient,
  ): Promise<ClientAuthView> {
    const row = await tx.client.create({
      data: {
        email: input.email,
        phone: input.phone,
        name: input.name,
        passwordHash: input.passwordHash,
        emailVerified: input.emailVerified,
        phoneVerified: input.phoneVerified,
        accountType: 'FULL',
        claimedAt: new Date(),
        consentedAt: input.consentedAt,
        consentVersion: input.consentVersion,
      },
      select: CLIENT_AUTH_SELECT,
    });
    return toView(row);
  }

  async setPasswordHash(
    tx: Prisma.TransactionClient,
    clientId: string,
    hash: string,
  ): Promise<void> {
    await tx.client.update({
      where: { id: clientId },
      data: { passwordHash: hash },
      select: { id: true },
    });
  }

  async bumpTokenVersion(
    tx: Prisma.TransactionClient,
    clientId: string,
  ): Promise<number> {
    const row = await tx.client.update({
      where: { id: clientId },
      data: { tokenVersion: { increment: 1 } },
      select: { tokenVersion: true },
    });
    return row.tokenVersion;
  }

  async recordFailedLogin(
    tx: Prisma.TransactionClient,
    clientId: string,
    next: { attempts: number; lockoutUntil: Date | null | undefined },
  ): Promise<void> {
    await tx.client.update({
      where: { id: clientId },
      data: {
        loginAttempts: next.attempts,
        ...(next.lockoutUntil !== undefined
          ? { lockoutUntil: next.lockoutUntil }
          : {}),
      },
      select: { id: true },
    });
  }

  async clearFailedLogin(
    tx: Prisma.TransactionClient,
    clientId: string,
  ): Promise<void> {
    await tx.client.update({
      where: { id: clientId },
      data: { loginAttempts: 0, lockoutUntil: null },
      select: { id: true },
    });
  }

  async markLastLogin(
    tx: Prisma.TransactionClient,
    clientId: string,
    at: Date,
  ): Promise<void> {
    await tx.client.update({
      where: { id: clientId },
      data: { lastLoginAt: at },
      select: { id: true },
    });
  }

  async setEmailProof(
    tx: Prisma.TransactionClient,
    clientId: string,
    next: { email: string; verifiedAt: Date },
  ): Promise<void> {
    await tx.client.update({
      where: { id: clientId },
      data: {
        email: next.email,
        emailVerified: next.verifiedAt,
        pendingEmail: null,
        emailPromptResolvedAt: next.verifiedAt,
      },
      select: { id: true },
    });
  }

  async clearEmailProof(
    tx: Prisma.TransactionClient,
    clientId: string,
  ): Promise<void> {
    await tx.client.update({
      where: { id: clientId },
      data: { emailVerified: null, pendingEmail: null },
      select: { id: true },
    });
  }

  async setPendingEmail(
    tx: Prisma.TransactionClient,
    clientId: string,
    pending: string | null,
  ): Promise<void> {
    await tx.client.update({
      where: { id: clientId },
      data: { pendingEmail: pending },
      select: { id: true },
    });
  }

  async setPhoneProof(
    tx: Prisma.TransactionClient,
    clientId: string,
    next: { phone: string; verifiedAt: Date },
  ): Promise<void> {
    await tx.client.update({
      where: { id: clientId },
      data: { phone: next.phone, phoneVerified: next.verifiedAt },
      select: { id: true },
    });
  }

  async anonymizeForDeletion(
    tx: Prisma.TransactionClient,
    clientId: string,
    at: Date,
  ): Promise<void> {
    await tx.client.update({
      where: { id: clientId },
      data: {
        deletedAt: at,
        isActive: false,
        email: null,
        phone: null,
        emailVerified: null,
        phoneVerified: null,
        pendingEmail: null,
        emailPromptResolvedAt: null,
        passwordHash: null,
        tokenVersion: { increment: 1 },
      },
      select: { id: true },
    });
  }

  async recordPasswordHistory(
    tx: Prisma.TransactionClient,
    clientId: string,
    hash: string,
    depth: number,
  ): Promise<void> {
    await tx.passwordHistory.create({ data: { clientId, passwordHash: hash } });
    const surplus = await tx.passwordHistory.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      skip: depth,
      select: { id: true },
    });
    if (surplus.length > 0) {
      await tx.passwordHistory.deleteMany({
        where: { id: { in: surplus.map((row) => row.id) } },
      });
    }
  }

  async listRecentPasswordHashes(
    tx: Prisma.TransactionClient,
    clientId: string,
    limit: number,
  ): Promise<string[]> {
    const rows = await tx.passwordHistory.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { passwordHash: true },
    });
    return rows.map((row) => row.passwordHash);
  }
}

function toView(row: ClientAuthRow): ClientAuthView {
  return {
    id: row.id,
    userId: row.userId,
    email: row.email,
    emailVerified: row.emailVerified,
    phone: row.phone,
    phoneVerified: row.phoneVerified,
    passwordHash: row.passwordHash,
    tokenVersion: row.tokenVersion,
    isActive: row.isActive,
    deletedAt: row.deletedAt,
    loginAttempts: row.loginAttempts,
    lockoutUntil: row.lockoutUntil,
    lastLoginAt: row.lastLoginAt,
  };
}
