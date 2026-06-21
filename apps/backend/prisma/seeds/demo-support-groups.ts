/**
 * Idempotent seed: inserts 6 demo public GroupSessions for the website "support-groups" section.
 *
 * Run: pnpm --filter=backend seed:support-groups
 * Safe to re-run — upserts by deterministic id.
 */

import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

type DeliveryType = 'IN_PERSON' | 'ONLINE';

const DEMOS: Array<{
  id: string;
  title: string;
  descriptionAr: string;
  descriptionEn: string;
  deliveryType: DeliveryType;
  sessions: number;
  maxCapacity: number;
  durationMins: number;
  priceHalalas: number;
  daysFromNow: number;
}> = [
  {
    id: '00000000-0000-4000-8000-000000005101',
    title: 'الحزن والفقد',
    descriptionAr: 'دعم جماعي لمن فقدوا عزيزاً، ومساحة آمنة للتعبير والتعافي.',
    descriptionEn: 'Group support for those grieving a loved one — a safe space to express and heal.',
    deliveryType: 'IN_PERSON',
    sessions: 10,
    maxCapacity: 10,
    durationMins: 90,
    priceHalalas: 15000,
    daysFromNow: 7,
  },
  {
    id: '00000000-0000-4000-8000-000000005102',
    title: 'العلاج بالفن',
    descriptionAr: 'التعبير الإبداعي لمعالجة المشاعر عبر الرسم والألوان في بيئة جماعية آمنة.',
    descriptionEn: 'Creative expression to process emotions through drawing and color in a safe group setting.',
    deliveryType: 'IN_PERSON',
    sessions: 8,
    maxCapacity: 10,
    durationMins: 90,
    priceHalalas: 18000,
    daysFromNow: 10,
  },
  {
    id: '00000000-0000-4000-8000-000000005103',
    title: 'الأمهات الجدد',
    descriptionAr: 'دعم ما بعد الولادة، اكتئاب الأمومة، وبناء الثقة بدور الأم.',
    descriptionEn: 'Postpartum support, maternal depression, and building confidence as a new mother.',
    deliveryType: 'ONLINE',
    sessions: 6,
    maxCapacity: 10,
    durationMins: 75,
    priceHalalas: 12000,
    daysFromNow: 5,
  },
  {
    id: '00000000-0000-4000-8000-000000005104',
    title: 'دائرة التعافي',
    descriptionAr: 'دعم مستمر للمتعافين من الإدمان وتعزيز الوقاية من الانتكاسة.',
    descriptionEn: 'Continuous support for those in addiction recovery and relapse prevention.',
    deliveryType: 'IN_PERSON',
    sessions: 12,
    maxCapacity: 10,
    durationMins: 90,
    priceHalalas: 20000,
    daysFromNow: 14,
  },
  {
    id: '00000000-0000-4000-8000-000000005105',
    title: 'القلق الاجتماعي',
    descriptionAr: 'تدريب تدريجي على المواقف الاجتماعية في بيئة داعمة وآمنة.',
    descriptionEn: 'Gradual training in social situations within a supportive, safe environment.',
    deliveryType: 'IN_PERSON',
    sessions: 10,
    maxCapacity: 10,
    durationMins: 90,
    priceHalalas: 16000,
    daysFromNow: 9,
  },
  {
    id: '00000000-0000-4000-8000-000000005106',
    title: 'دعم المراهقين',
    descriptionAr: 'مهارات اجتماعية وبناء الهوية في مجموعة أقران من نفس الفئة.',
    descriptionEn: 'Social skills and identity building in a peer group of the same age range.',
    deliveryType: 'IN_PERSON',
    sessions: 8,
    maxCapacity: 10,
    durationMins: 75,
    priceHalalas: 14000,
    daysFromNow: 12,
  },
];

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });
  await prisma.$connect();

  const branch = await prisma.branch.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!branch) {
    throw new Error('No Branch found. Run `pnpm db:seed` first.');
  }

  const employee = await prisma.employee.findFirst({
    where: { isPublic: true, isActive: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!employee) {
    throw new Error('No public Employee found. Run `pnpm --filter=backend seed:therapists` first.');
  }

  let service = await prisma.service.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!service) {
    service = await prisma.service.create({
      data: {
        nameAr: 'جلسة دعم جماعي',
        nameEn: 'Group Support Session',
        descriptionAr: 'جلسة دعم جماعي بإشراف متخصص.',
        durationMins: 90,
        price: 15000,
        currency: 'SAR',
        isActive: true,
      },
    });
    console.log(`created fallback group service: ${service.id}`);
  }

  // Ensure the group service has at least one ServiceBookingConfig row,
  // otherwise the booking wizard shows "لا توجد أنواع حجز متاحة" and
  // group bookings can never be created from the dashboard.
  await prisma.serviceBookingConfig.upsert({
    where: { serviceId_deliveryType: { serviceId: service.id, deliveryType: 'IN_PERSON' } },
    update: {},
    create: {
      serviceId: service.id,
      deliveryType: 'IN_PERSON',
      price: service.price,
      durationMins: service.durationMins,
      isActive: true,
    },
  });

  for (const d of DEMOS) {
    const scheduledAt = new Date(Date.now() + d.daysFromNow * 24 * 60 * 60 * 1000);
    scheduledAt.setHours(18, 0, 0, 0);

    await prisma.groupSession.upsert({
      where: { id: d.id },
      update: {
        title: d.title,
        descriptionAr: d.descriptionAr,
        descriptionEn: d.descriptionEn,
        publicDescriptionAr: d.descriptionAr,
        publicDescriptionEn: d.descriptionEn,
        scheduledAt,
        durationMins: d.durationMins,
        maxCapacity: d.maxCapacity,
        price: d.priceHalalas,
        currency: 'SAR',
        status: 'OPEN',
        deliveryType: d.deliveryType,
        isPublic: true,
      },
      create: {
        id: d.id,
        branchId: branch.id,
        employeeId: employee.id,
        serviceId: service.id,
        title: d.title,
        descriptionAr: d.descriptionAr,
        descriptionEn: d.descriptionEn,
        publicDescriptionAr: d.descriptionAr,
        publicDescriptionEn: d.descriptionEn,
        scheduledAt,
        durationMins: d.durationMins,
        maxCapacity: d.maxCapacity,
        enrolledCount: 0,
        price: d.priceHalalas,
        currency: 'SAR',
        status: 'OPEN',
        deliveryType: d.deliveryType,
        isPublic: true,
      },
    });
    console.log(`upserted: ${d.title}`);
  }

  const count = await prisma.groupSession.count({
    where: { isPublic: true, status: 'OPEN', scheduledAt: { gte: new Date() } },
  });
  console.log(`\npublic OPEN upcoming group sessions: ${count}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
