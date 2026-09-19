/**
 * Read-only audit for the legacy User.CLIENT -> Client identity boundary.
 *
 * Usage:
 *   DATABASE_URL='postgresql://.../sawaa_test' pnpm exec tsx scripts/audit-mobile-client-identity.ts
 *   pnpm exec tsx scripts/audit-mobile-client-identity.ts --database-url 'postgresql://.../sawaa_test'
 *
 * The script performs only Prisma reads inside one transaction. It prints
 * counts and opaque database ids; contact values are intentionally never
 * emitted. It proposes only the safe, exact-phone lazy-link candidates.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '@prisma/client';

function databaseUrl(): string {
  const argIndex = process.argv.indexOf('--database-url');
  const fromArg = argIndex >= 0 ? process.argv[argIndex + 1] : undefined;
  const value = fromArg ?? process.env.DATABASE_URL;
  if (!value) {
    throw new Error('Provide --database-url or DATABASE_URL. No fallback is allowed.');
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('The audit database target must be a valid PostgreSQL URL.');
  }
  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
    throw new Error('The audit database target must use PostgreSQL.');
  }
  if (!parsed.pathname.replace(/^\/+/, '')) {
    throw new Error('The audit database target must include a database name.');
  }
  return value;
}

type ClientRow = {
  id: string;
  userId: string | null;
  phone: string | null;
  email: string | null;
  isActive: boolean;
  phoneVerified: Date | null;
  deletedAt: Date | null;
};

function normalizedEmail(value: string): string {
  return value.trim().toLowerCase();
}

async function main(): Promise<void> {
  const target = databaseUrl();
  process.env.DATABASE_URL = target;
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: target, connectionTimeoutMillis: 5_000, statement_timeout: 15_000 }),
  });
  try {
    const report = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      const [users, clients] = await Promise.all([
        tx.user.findMany({
          where: { role: 'CLIENT' },
          select: { id: true, phone: true, email: true, isActive: true, phoneVerifiedAt: true },
        }),
        tx.client.findMany({
          select: { id: true, userId: true, phone: true, email: true, isActive: true, phoneVerified: true, deletedAt: true },
        }),
      ]);

      const byUser = new Map<string, ClientRow[]>();
      for (const client of clients) {
        if (!client.userId) continue;
        const rows = byUser.get(client.userId) ?? [];
        rows.push(client);
        byUser.set(client.userId, rows);
      }

      const duplicateLinks = [...byUser.entries()]
        .filter(([, rows]) => rows.length > 1)
        .map(([userId, rows]) => ({ userId, clientIds: rows.map((row) => row.id) }));
      const unlinkedUsers = users
        .filter((user) => !(byUser.get(user.id)?.length))
        .map((user) => user.id);
      const inactiveOrDeletedLinks = clients
        .filter((client) => client.userId && (!client.isActive || client.deletedAt !== null))
        .map((client) => client.id);

      const groups = (field: 'phone' | 'email') => {
        const grouped = new Map<string, ClientRow[]>();
        for (const client of clients) {
          const value = client[field];
          if (!value) continue;
          const key = field === 'email' ? normalizedEmail(value) : value;
          const rows = grouped.get(key) ?? [];
          rows.push(client);
          grouped.set(key, rows);
        }
        return [...grouped.values()]
          .filter((rows) => rows.length > 1)
          .map((rows) => rows.map((row) => row.id));
      };

      const clientsByPhone = new Map<string, ClientRow[]>();
      const clientsByEmail = new Map<string, ClientRow[]>();
      for (const client of clients) {
        if (!client.phone) continue;
        const rows = clientsByPhone.get(client.phone) ?? [];
        rows.push(client);
        clientsByPhone.set(client.phone, rows);
      }
      for (const client of clients) {
        if (!client.email) continue;
        const key = normalizedEmail(client.email);
        const rows = clientsByEmail.get(key) ?? [];
        rows.push(client);
        clientsByEmail.set(key, rows);
      }
      const safeLazyPhoneLinks: Array<{ userId: string; clientId: string }> = [];
      const blockedPhoneLinks: Array<{ userId: string; candidateClientIds: string[]; reason: string }> = [];
      for (const user of users) {
        if (byUser.has(user.id) || !user.phone) continue;
        const matches = clientsByPhone.get(user.phone) ?? [];
        const eligible = matches.filter((client) => client.isActive && client.deletedAt === null);
        const phoneCandidate = eligible.length === 1 ? eligible[0] : undefined;
        const emailConflicts = (clientsByEmail.get(normalizedEmail(user.email)) ?? [])
          .filter((client) => client.id !== phoneCandidate?.id && client.userId !== user.id);
        if (user.isActive && user.phoneVerifiedAt !== null && eligible.length === 1 &&
            !eligible[0].userId && eligible[0].phoneVerified !== null && emailConflicts.length === 0) {
          safeLazyPhoneLinks.push({ userId: user.id, clientId: eligible[0].id });
        } else if (matches.length > 0 || emailConflicts.length > 0) {
          blockedPhoneLinks.push({
            userId: user.id,
            candidateClientIds: [...new Set([...matches.map((client) => client.id), ...emailConflicts.map((client) => client.id)])],
            reason: !user.isActive || user.phoneVerifiedAt === null
              ? 'user_not_active_or_phone_unverified'
              : emailConflicts.length > 0
                ? 'cross_email_conflict'
                : eligible.length !== 1
                  ? 'ambiguous_or_inactive_phone_match'
                  : 'phone_already_linked',
          });
        }
      }

      return {
        userClientRoleCount: users.length,
        clientCount: clients.length,
        unlinkedUserClientIds: unlinkedUsers,
        multipleClientLinkGroups: duplicateLinks,
        inactiveOrDeletedLinkedClientIds: inactiveOrDeletedLinks,
        duplicatePhoneClientIdGroups: groups('phone'),
        duplicateEmailClientIdGroups: groups('email'),
        safeLazyPhoneLinks,
        blockedPhoneLinks,
      };
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      timeout: 30_000,
    });
    console.log(JSON.stringify({ readOnly: true, transaction: 'READ ONLY', ...report }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  // Do not echo adapter errors: they can contain connection URLs or database details.
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String(error.code).replace(/[^A-Za-z0-9_]/g, '').slice(0, 32)
    : 'UNAVAILABLE';
  console.error(`Mobile Client identity audit failed (${code}). No changes were made.`);
  process.exitCode = 1;
});
