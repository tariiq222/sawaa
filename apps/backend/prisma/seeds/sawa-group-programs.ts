/**
 * Idempotent seed: populates the group-sessions department ("جلسات جماعية" /
 * prod "جماعية") with 6 group-program categories, each with one bookable GROUP
 * service (maxParticipants > 1) + ServiceBookingConfig, so the website
 * /support-groups page renders from real catalog data (GET /public/services).
 *
 * The department is located by nameAr CONTAINS 'جماعية' (local dev uses
 * "جلسات جماعية", production uses "جماعية"). If missing, it is created
 * following the sawa-customer.ts shape.
 *
 * The demo-support-groups fallback service ("جلسة دعم جماعي") is left alone.
 *
 * Run:  pnpm --filter=backend seed:group-programs
 * Safe to re-run — upserts by deterministic id.
 */

import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import Redis, { type RedisOptions } from 'ioredis';

const SERVICES_CACHE_PREFIX = 'ref:services:';

type DeliveryType = 'IN_PERSON' | 'ONLINE';

const PROGRAMS: Array<{
  categoryId: string;
  serviceId: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  iconName: string; // Lucide icon name (matches website ICON_MAP)
  sortOrder: number;
  deliveryType: DeliveryType;
  durationMins: number;
  priceHalalas: number;
}> = [
  {
    categoryId: '00000000-0000-4000-8000-000000005201',
    serviceId: '00000000-0000-4000-8000-000000005301',
    nameAr: 'العلاج بالفن',
    nameEn: 'Art Therapy',
    descriptionAr:
      'التعبير الإبداعي لمعالجة المشاعر عبر الرسم والألوان في بيئة جماعية آمنة.',
    descriptionEn:
      'Creative expression to process emotions through drawing and color in a safe group setting.',
    iconName: 'Sparkles',
    sortOrder: 0,
    deliveryType: 'IN_PERSON',
    durationMins: 90,
    priceHalalas: 18000,
  },
  {
    categoryId: '00000000-0000-4000-8000-000000005202',
    serviceId: '00000000-0000-4000-8000-000000005302',
    nameAr: 'الحزن والفقد',
    nameEn: 'Grief & Loss',
    descriptionAr:
      'دعم جماعي لمن فقدوا عزيزاً، ومساحة آمنة للتعبير والتعافي.',
    descriptionEn:
      'Group support for those grieving a loved one — a safe space to express and heal.',
    iconName: 'Heart',
    sortOrder: 1,
    deliveryType: 'IN_PERSON',
    durationMins: 90,
    priceHalalas: 15000,
  },
  {
    categoryId: '00000000-0000-4000-8000-000000005203',
    serviceId: '00000000-0000-4000-8000-000000005303',
    nameAr: 'دائرة التعافي',
    nameEn: 'Recovery Circle',
    descriptionAr:
      'دعم مستمر للمتعافين من الإدمان وتعزيز الوقاية من الانتكاسة.',
    descriptionEn:
      'Continuous support for those in addiction recovery and relapse prevention.',
    iconName: 'RefreshCw',
    sortOrder: 2,
    deliveryType: 'IN_PERSON',
    durationMins: 90,
    priceHalalas: 20000,
  },
  {
    categoryId: '00000000-0000-4000-8000-000000005204',
    serviceId: '00000000-0000-4000-8000-000000005304',
    nameAr: 'الأمهات الجدد',
    nameEn: 'New Mothers',
    descriptionAr:
      'دعم ما بعد الولادة، اكتئاب الأمومة، وبناء الثقة بدور الأم.',
    descriptionEn:
      'Postpartum support, maternal depression, and building confidence as a new mother.',
    iconName: 'Baby',
    sortOrder: 3,
    deliveryType: 'ONLINE',
    durationMins: 75,
    priceHalalas: 12000,
  },
  {
    categoryId: '00000000-0000-4000-8000-000000005205',
    serviceId: '00000000-0000-4000-8000-000000005305',
    nameAr: 'دعم المراهقين',
    nameEn: 'Teen Support',
    descriptionAr:
      'مهارات اجتماعية وبناء الهوية في مجموعة أقران من نفس الفئة.',
    descriptionEn:
      'Social skills and identity building in a peer group of the same age range.',
    iconName: 'Smile',
    sortOrder: 4,
    deliveryType: 'IN_PERSON',
    durationMins: 75,
    priceHalalas: 14000,
  },
  {
    categoryId: '00000000-0000-4000-8000-000000005206',
    serviceId: '00000000-0000-4000-8000-000000005306',
    nameAr: 'القلق الاجتماعي',
    nameEn: 'Social Anxiety',
    descriptionAr:
      'تدريب تدريجي على المواقف الاجتماعية في بيئة داعمة وآمنة.',
    descriptionEn:
      'Gradual training in social situations within a supportive, safe environment.',
    iconName: 'Brain',
    sortOrder: 5,
    deliveryType: 'IN_PERSON',
    durationMins: 90,
    priceHalalas: 16000,
  },
];

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });
  await prisma.$connect();

  // Local dev: "جلسات جماعية" — production: "جماعية". Match by contains.
  let department = await prisma.department.findFirst({
    where: { nameAr: { contains: 'جماعية' } },
    orderBy: { sortOrder: 'asc' },
  });

  if (!department) {
    department = await prisma.department.create({
      data: {
        nameAr: 'جلسات جماعية',
        nameEn: 'Group Sessions',
        descriptionAr:
          'جلسات علاجية جماعية للمتعافين من الإدمان والمرضى النفسيين عبر أنشطة داعمة',
        descriptionEn:
          'Group therapy sessions for recovering addicts and psychiatric patients through supportive activities',
        icon: 'Users',
        sortOrder: 1,
        isActive: true,
        isVisible: true,
      },
    });
    console.log(`created group department: ${department.id}`);
  } else {
    console.log(`✓ Group department: ${department.nameAr} (${department.id})`);
  }

  for (const p of PROGRAMS) {
    await prisma.serviceCategory.upsert({
      where: { id: p.categoryId },
      update: {
        departmentId: department.id,
        nameAr: p.nameAr,
        nameEn: p.nameEn,
        sortOrder: p.sortOrder,
        isActive: true,
      },
      create: {
        id: p.categoryId,
        departmentId: department.id,
        nameAr: p.nameAr,
        nameEn: p.nameEn,
        sortOrder: p.sortOrder,
        isActive: true,
      },
    });

    const serviceData = {
      categoryId: p.categoryId,
      nameAr: `جلسة جماعية — ${p.nameAr}`,
      nameEn: `Group Session — ${p.nameEn}`,
      descriptionAr: p.descriptionAr,
      descriptionEn: p.descriptionEn,
      durationMins: p.durationMins,
      price: p.priceHalalas,
      currency: 'SAR',
      iconName: p.iconName,
      minParticipants: 4,
      maxParticipants: 10,
      // Public catalog visibility (GET /public/services requires all three).
      isActive: true,
      isHidden: false,
      archivedAt: null,
    };

    await prisma.service.upsert({
      where: { id: p.serviceId },
      update: serviceData,
      create: { id: p.serviceId, ...serviceData },
    });

    await prisma.serviceBookingConfig.upsert({
      where: {
        serviceId_deliveryType: {
          serviceId: p.serviceId,
          deliveryType: p.deliveryType,
        },
      },
      update: {
        price: p.priceHalalas,
        durationMins: p.durationMins,
        isActive: true,
      },
      create: {
        serviceId: p.serviceId,
        deliveryType: p.deliveryType,
        price: p.priceHalalas,
        durationMins: p.durationMins,
        isActive: true,
      },
    });

    console.log(`upserted: ${p.nameAr} (category + service + booking config)`);
  }

  // -------------------------------------------------------------------------
  // Link public therapists to each group service. The website counts
  // therapists per service via GET /public/employees → serviceIds, which is
  // built from EmployeeService rows (see list-public-employees.handler.ts).
  // Spread assignments round-robin across available public therapists.
  // -------------------------------------------------------------------------
  const therapists = await prisma.employee.findMany({
    where: { isPublic: true, isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true, nameAr: true, slug: true },
  });

  const therapistByService = new Map<string, string>();
  if (therapists.length === 0) {
    console.warn(
      '! No public active employees — group services will show 0 therapists. Run seed:therapists first.',
    );
  } else {
    for (const [i, p] of PROGRAMS.entries()) {
      const therapist = therapists[i % therapists.length];
      await prisma.employeeService.upsert({
        where: {
          employeeId_serviceId: { employeeId: therapist.id, serviceId: p.serviceId },
        },
        update: { isActive: true },
        create: { employeeId: therapist.id, serviceId: p.serviceId },
      });
      therapistByService.set(p.serviceId, therapist.id);
      console.log(`linked therapist: ${therapist.nameAr ?? therapist.slug} → ${p.nameAr}`);
    }
  }

  // -------------------------------------------------------------------------
  // Re-point the demo GroupSessions (seeds/demo-support-groups.ts, ids
  // …5101–5106) from the fallback service to the matching per-program service
  // by exact title, so detail pages (which list sessions by service) show
  // them. Skips silently when the demo sessions are absent. Safe vs re-runs of
  // seed:support-groups — its upsert update branch never touches serviceId.
  // -------------------------------------------------------------------------
  const DEMO_SESSION_IDS = [
    '00000000-0000-4000-8000-000000005101',
    '00000000-0000-4000-8000-000000005102',
    '00000000-0000-4000-8000-000000005103',
    '00000000-0000-4000-8000-000000005104',
    '00000000-0000-4000-8000-000000005105',
    '00000000-0000-4000-8000-000000005106',
  ];
  const demoSessions = await prisma.groupSession.findMany({
    where: { id: { in: DEMO_SESSION_IDS } },
    select: { id: true, title: true, serviceId: true },
  });
  const programByTitle = new Map(PROGRAMS.map((p) => [p.nameAr, p]));
  for (const s of demoSessions) {
    const program = programByTitle.get(s.title.trim());
    if (!program || s.serviceId === program.serviceId) continue;
    const assignedTherapist = therapistByService.get(program.serviceId);
    await prisma.groupSession.update({
      where: { id: s.id },
      data: {
        serviceId: program.serviceId,
        ...(assignedTherapist ? { employeeId: assignedTherapist } : {}),
      },
    });
    console.log(`re-pointed session "${s.title}" → service ${program.serviceId}`);
  }

  const categoryCount = await prisma.serviceCategory.count({
    where: { departmentId: department.id, isActive: true },
  });
  const serviceCount = await prisma.service.count({
    where: {
      isActive: true,
      isHidden: false,
      archivedAt: null,
      category: { departmentId: department.id },
    },
  });
  console.log(
    `\n✓ Group department now has ${categoryCount} active categories, ${serviceCount} public services`,
  );

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
