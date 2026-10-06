/** Read-only canonical-index preflight. Counts only; never prints contacts. */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  try {
    const counts = await prisma.$transaction(async tx => {
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      const user = await tx.$queryRaw<Array<{ count: bigint }>>`SELECT count(*) FROM (SELECT lower(email) FROM "User" GROUP BY lower(email) HAVING count(*) > 1) collisions`;
      const client = await tx.$queryRaw<Array<{ count: bigint }>>`SELECT count(*) FROM (SELECT lower(email) FROM "Client" WHERE email IS NOT NULL AND email <> '' AND "deletedAt" IS NULL GROUP BY lower(email) HAVING count(*) > 1) collisions`;
      const cross = await tx.$queryRaw<Array<{ count: bigint }>>`SELECT count(*) FROM "User" u JOIN "Client" c ON lower(u.email) = lower(c.email) WHERE c."userId" IS DISTINCT FROM u.id`;
      const linked = await tx.$queryRaw<Array<{ count: bigint }>>`SELECT count(*) FROM "User" u JOIN "Client" c ON c."userId" = u.id WHERE (c.email IS NOT NULL AND c.email <> '' AND lower(c.email) <> lower(u.email)) OR (c.phone IS NOT NULL AND u.phone IS NOT NULL AND c.phone <> u.phone)`;
      return { duplicateUserEmails: Number(user[0].count), duplicateActiveClientEmails: Number(client[0].count), inconsistentCrossTableEmailOwnership: Number(cross[0].count), inconsistentLinkedContacts: Number(linked[0].count) };
    });
    console.log(JSON.stringify(counts));
    if (Object.values(counts).some(value => value > 0)) process.exitCode = 1;
  } finally { await prisma.$disconnect(); }
}
main().catch(() => { console.error('Email-entry preflight failed; no contact data emitted'); process.exitCode = 1; });
