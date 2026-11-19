import type { Prisma } from '@prisma/client';

/**
 * Injection token for the `Client` account store (MNT-19.1, ADR-002).
 *
 * The contract lives in `common` on purpose: importing a *file* from
 * `modules/people` counts as a module→module edge in the boundary ratchet,
 * while importing this neutral contract does not. The contract must never
 * import from `src/modules/**` or it would create a reverse-layer edge.
 */
export const CLIENT_ACCOUNT_STORE = Symbol('CLIENT_ACCOUNT_STORE');

/**
 * Explicit projection of the authentication-relevant columns on `Client`.
 *
 * Deliberately NOT the full Prisma row: profile, medical and consent fields
 * stay in `people`'s own serializers. Secrets such as `pendingEmail`,
 * `emailPromptResolvedAt` and `passwordHash` are present only because the
 * login / reset flows need them inside a transaction.
 */
export interface ClientAuthView {
  id: string;
  userId: string | null;
  email: string | null;
  emailVerified: Date | null;
  phone: string | null;
  phoneVerified: Date | null;
  passwordHash: string | null;
  tokenVersion: number;
  isActive: boolean;
  deletedAt: Date | null;
  loginAttempts: number;
  lockoutUntil: Date | null;
  lastLoginAt: Date | null;
}

/** Named fields only — callers can never pass an arbitrary `ClientUpdateInput`. */
export interface NewRegisteredClient {
  email: string | null;
  phone: string | null;
  name: string;
  passwordHash: string;
  emailVerified: Date | null;
  phoneVerified: Date | null;
  consentedAt: Date | null;
  consentVersion: string | null;
}

/**
 * The single write/read seam for `Client` authentication state.
 *
 * Every method takes the caller's `Prisma.TransactionClient`. The store never
 * opens its own transaction and never uses `PrismaService`, so the caller keeps
 * transaction ownership, lock ordering and serializable-retry semantics.
 */
export interface ClientAccountStore {
  /** Find by exactly one identifier. Unknown/deleted rows are returned as null. */
  findByIdentifier(
    tx: Prisma.TransactionClient,
    by: { email: string } | { phone: string },
  ): Promise<ClientAuthView | null>;

  /** `SELECT ... FOR UPDATE` on the client row, then read it back. */
  lockForAuth(
    tx: Prisma.TransactionClient,
    clientId: string,
  ): Promise<ClientAuthView | null>;

  /** Create a fully-registered client row (register / mobile account creation). */
  createRegisteredClient(
    tx: Prisma.TransactionClient,
    input: NewRegisteredClient,
  ): Promise<ClientAuthView>;

  setPasswordHash(
    tx: Prisma.TransactionClient,
    clientId: string,
    hash: string,
  ): Promise<void>;

  /** Increments `tokenVersion` and returns the new value. */
  bumpTokenVersion(
    tx: Prisma.TransactionClient,
    clientId: string,
  ): Promise<number>;

  /**
   * Records a failed login. `lockoutUntil` is set only when the caller decides
   * a lockout is due; passing `null` leaves the current value untouched.
   */
  recordFailedLogin(
    tx: Prisma.TransactionClient,
    clientId: string,
    next: { attempts: number; lockoutUntil: Date | null | undefined },
  ): Promise<void>;

  clearFailedLogin(
    tx: Prisma.TransactionClient,
    clientId: string,
  ): Promise<void>;

  markLastLogin(
    tx: Prisma.TransactionClient,
    clientId: string,
    at: Date,
  ): Promise<void>;

  setEmailProof(
    tx: Prisma.TransactionClient,
    clientId: string,
    next: { email: string; verifiedAt: Date },
  ): Promise<void>;

  clearEmailProof(
    tx: Prisma.TransactionClient,
    clientId: string,
  ): Promise<void>;

  setPendingEmail(
    tx: Prisma.TransactionClient,
    clientId: string,
    pending: string | null,
  ): Promise<void>;

  setPhoneProof(
    tx: Prisma.TransactionClient,
    clientId: string,
    next: { phone: string; verifiedAt: Date },
  ): Promise<void>;

  /**
   * PDPL account deletion: anonymizes identity fields and bumps `tokenVersion`
   * so every outstanding session dies with the same write.
   */
  anonymizeForDeletion(
    tx: Prisma.TransactionClient,
    clientId: string,
    at: Date,
  ): Promise<void>;

  recordPasswordHistory(
    tx: Prisma.TransactionClient,
    clientId: string,
    hash: string,
    depth: number,
  ): Promise<void>;

  listRecentPasswordHashes(
    tx: Prisma.TransactionClient,
    clientId: string,
    limit: number,
  ): Promise<string[]>;
}
