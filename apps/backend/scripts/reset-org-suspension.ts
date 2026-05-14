/**
 * Dev utility — clears suspension state on the default org + its Redis cache key.
 * Usage:  npm run reset:org-suspension            # default org
 *         npm run reset:org-suspension <orgId>    # specific org
 */

import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

const DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000001';
const orgId = process.argv[2] ?? DEFAULT_ORG_ID;

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });
  await prisma.$connect();

  const result = await prisma.organization.updateMany({
    where: { id: orgId },
    data: { suspendedAt: null, suspendedReason: null, status: 'ACTIVE' },
  });
  await prisma.$disconnect();

  const redis = new Redis({
    host: process.env.REDIS_HOST ?? 'localhost',
    port: Number(process.env.REDIS_PORT ?? 6379),
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });
  await redis.connect();
  const deleted = await redis.del(`org-suspension:${orgId}`);
  await redis.quit();

  console.log(`✔  DB rows updated:   ${result.count}`);
  console.log(`✔  Redis keys purged: ${deleted}`);
  console.log(`✔  org ${orgId} is now ACTIVE`);
}

main().catch((e) => { console.error(e); process.exit(1); });
