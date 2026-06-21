/**
 * Idempotent seed: gives each Sawa clinic (ServiceCategory) exactly two services
 * — "جلسة" and "استشارة" — each with in-person + online booking configs.
 *
 * The 'القياس والتقويم' clinic is excluded entirely.
 *
 * Run:  npm run seed:sawa-clinic-services --workspace=backend
 * Safe to re-run.
 */

import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import Redis, { type RedisOptions } from 'ioredis';

const SERVICES_CACHE_PREFIX = 'ref:services:';

const SERVICES = [
  {
    nameAr: 'جلسة',
    nameEn: 'Session',
    durationMins: 60,
    price: 20000,
    currency: 'SAR',
    isActive: true,
  },
  {
    nameAr: 'استشارة',
    nameEn: 'Consultation',
    durationMins: 45,
    price: 15000,
    currency: 'SAR',
    isActive: true,
  },
];

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });
  await prisma.$connect();

  const department = await prisma.department.findUnique({
    where: { nameAr: 'عيادات سواء' },
  });
  if (!department) {
    console.error("✗ Department with nameAr='عيادات سواء' not found");
    await prisma.$disconnect();
    process.exit(1);
  }

  const allCategories = await prisma.serviceCategory.findMany({
    where: { departmentId: department.id },
  });

  const excludedCategories = allCategories.filter((c) =>
    c.nameAr.includes('القياس'),
  );
  const targetCategories = allCategories.filter(
    (c) => !c.nameAr.includes('القياس'),
  );

  let servicesCreated = 0;
  for (const category of targetCategories) {
    await prisma.service.deleteMany({ where: { categoryId: category.id } });

    for (const service of SERVICES) {
      await prisma.service.create({
        data: {
          categoryId: category.id,
          nameAr: service.nameAr,
          nameEn: service.nameEn,
          durationMins: service.durationMins,
          price: service.price,
          currency: service.currency,
          isActive: service.isActive,
          bookingConfigs: {
            create: [
              {
                deliveryType: 'IN_PERSON',
                price: service.price,
                durationMins: service.durationMins,
                isActive: true,
              },
              {
                deliveryType: 'ONLINE',
                price: service.price,
                durationMins: service.durationMins,
                isActive: true,
              },
            ],
          },
        },
      });
      servicesCreated += 1;
    }
  }

  const excludedNames = excludedCategories.map((c) => c.nameAr).join(', ');
  console.log(
    `✓ Processed ${targetCategories.length} clinics, created ${servicesCreated} services`,
  );
  console.log(`  Excluded clinic(s): ${excludedNames || '(none)'}`);

  await invalidateServicesCache();

  await prisma.$disconnect();
}

async function invalidateServicesCache(): Promise<void> {
  const host = process.env.REDIS_HOST;
  const port = Number(process.env.REDIS_PORT);
  if (!host || !Number.isInteger(port)) {
    console.warn('! Skipped services cache invalidation: REDIS_HOST/REDIS_PORT not set');
    return;
  }

  const options: RedisOptions = {
    host,
    port,
    db: Number(process.env.REDIS_DB ?? 0),
    password: process.env.REDIS_PASSWORD || undefined,
    lazyConnect: false,
    enableReadyCheck: true,
  };
  const redis = new Redis(options);

  try {
    let deleted = 0;
    let cursor = '0';
    do {
      const [next, keys] = await redis.scan(
        cursor,
        'MATCH',
        `${SERVICES_CACHE_PREFIX}*`,
        'COUNT',
        200,
      );
      cursor = next;
      if (keys.length > 0) {
        deleted += await redis.del(...keys);
      }
    } while (cursor !== '0');

    console.log(`✓ Invalidated ${deleted} services cache key(s)`);
  } catch (err) {
    console.warn(
      `! Services cache invalidation failed: ${err instanceof Error ? err.message : err}`,
    );
  } finally {
    await redis.quit();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
