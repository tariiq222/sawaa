/**
 * Idempotent seed: creates 4 group sessions with ~21 group bookings covering
 * various BookingStatus values (COMPLETED, NO_SHOW, CANCELLED, CONFIRMED,
 * AWAITING_PAYMENT, PENDING_GROUP_FILL).
 *
 * Uses deterministic UUIDs for GroupSession records (ids 6101–6104) so that
 * re-runs clean up previous data and re-create it cleanly.
 *
 * Run:  pnpm --filter=backend seed:group-sessions
 * Safe to re-run — deletes seeded data by groupSessionId before re-creating.
 */

import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const SESSION_IDS = [
  '00000000-0000-4000-8000-000000006101',
  '00000000-0000-4000-8000-000000006102',
  '00000000-0000-4000-8000-000000006103',
  '00000000-0000-4000-8000-000000006104',
] as const;

// Base date aligned with sawa-clinics-demo.ts
const BASE = new Date('2026-06-19T00:00:00.000Z');

function daysAgo(n: number, hour: number, minute = 0): Date {
  const d = new Date(BASE);
  d.setDate(d.getDate() - n);
  // Riyadh UTC+3 → UTC offset: subtract 3 hours
  d.setUTCHours(hour - 3, minute, 0, 0);
  return d;
}

function daysAhead(n: number, hour: number, minute = 0): Date {
  const d = new Date(BASE);
  d.setDate(d.getDate() + n);
  d.setUTCHours(hour - 3, minute, 0, 0);
  return d;
}

function endsAt(scheduledAt: Date, durationMins: number): Date {
  return new Date(scheduledAt.getTime() + durationMins * 60 * 1000);
}

// Saudi phone numbers that do NOT collide with sawa-clinics-demo.ts (+966501234001–018)
const CLIENT_PHONES = [
  '+966509876001',
  '+966509876002',
  '+966509876003',
  '+966509876004',
  '+966509876005',
  '+966509876006',
  '+966509876007',
  '+966509876008',
];

const CLIENT_NAMES = [
  'فاطمة العمري',
  'خالد الزهراني',
  'نورة القحطاني',
  'عبدالله المطيري',
  'سارة الغامدي',
  'محمد العسيري',
  'ريم الدوسري',
  'يوسف الشهري',
];

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });
  await prisma.$connect();

  // ── Cleanup: remove previous seeded data tied to these sessions ────────────
  console.log('Cleaning up previous group session seed data…');
  await prisma.groupEnrollment.deleteMany({
    where: { groupSessionId: { in: [...SESSION_IDS] } },
  });
  // BookingStatusLog doesn't support nested relation filters — collect bookingIds first
  const existingBookings = await prisma.booking.findMany({
    where: { groupSessionId: { in: [...SESSION_IDS] } },
    select: { id: true },
  });
  if (existingBookings.length > 0) {
    const bookingIds = existingBookings.map((b) => b.id);
    await prisma.bookingStatusLog.deleteMany({
      where: { bookingId: { in: bookingIds } },
    });
  }
  await prisma.booking.deleteMany({
    where: { groupSessionId: { in: [...SESSION_IDS] } },
  });
  await prisma.groupSession.deleteMany({
    where: { id: { in: [...SESSION_IDS] } },
  });
  console.log('Cleanup done.');

  // ── Resolve required foreign keys ──────────────────────────────────────────
  const branch = await prisma.branch.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!branch) throw new Error('No branch found. Run seed:sawa first.');

  const employee = await prisma.employee.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!employee) throw new Error('No active employee found. Run seed:therapists first.');

  // Find a group-capable service (maxParticipants > 1), or create a minimal one
  let service = await prisma.service.findFirst({
    where: { isActive: true, maxParticipants: { gt: 1 } },
    orderBy: { createdAt: 'asc' },
  });
  if (!service) {
    console.log('No group service found — creating a minimal fallback service…');
    // Need a category first
    let dept = await prisma.department.findFirst({
      where: { nameAr: { contains: 'جماعية' } },
    });
    if (!dept) {
      dept = await prisma.department.create({
        data: {
          nameAr: 'جلسات جماعية',
          nameEn: 'Group Sessions',
          icon: 'Users',
          isActive: true,
          isVisible: true,
        },
      });
    }
    const cat = await prisma.serviceCategory.create({
      data: { departmentId: dept.id, nameAr: 'جلسات عامة', nameEn: 'General Group Sessions' },
    });
    service = await prisma.service.create({
      data: {
        categoryId: cat.id,
        nameAr: 'جلسة جماعية',
        nameEn: 'Group Session',
        durationMins: 90,
        price: 15000,
        currency: 'SAR',
        maxParticipants: 10,
        isActive: true,
        isHidden: false,
      },
    });
    console.log(`Created fallback group service: ${service.id}`);
  }

  console.log(`Using branch: ${branch.nameAr ?? branch.id}`);
  console.log(`Using employee: ${employee.nameAr ?? employee.id}`);
  console.log(`Using service: ${service.nameAr ?? service.id}`);

  // ── Upsert 8 demo clients ──────────────────────────────────────────────────
  // Client.phone has no Prisma @unique so we can't use upsert({where:{phone}}).
  // Use findFirst + create pattern for idempotency.
  const clients: { id: string }[] = [];
  for (let i = 0; i < 8; i++) {
    let client = await prisma.client.findFirst({
      where: { phone: CLIENT_PHONES[i] },
      select: { id: true },
    });
    if (!client) {
      client = await prisma.client.create({
        data: {
          phone: CLIENT_PHONES[i],
          name: CLIENT_NAMES[i],
          isActive: true,
        },
        select: { id: true },
      });
    }
    clients.push({ id: client.id });
  }
  console.log(`Resolved ${clients.length} demo clients.`);

  // ── Helper to get next available booking number ────────────────────────────
  // Start from 9001 to avoid collision with sawa-clinics-demo.ts
  let bookingNumberCounter = 9001;
  const usedBookingNumbers = new Set<number>();

  const getBookingNumber = async (): Promise<number> => {
    // Find the max existing booking number >= 9001 to avoid collision
    if (bookingNumberCounter === 9001 && usedBookingNumbers.size === 0) {
      const maxResult = await prisma.booking.findFirst({
        where: { bookingNumber: { gte: 9001 } },
        orderBy: { bookingNumber: 'desc' },
        select: { bookingNumber: true },
      });
      if (maxResult) {
        bookingNumberCounter = maxResult.bookingNumber + 1;
      }
    }
    const num = bookingNumberCounter++;
    usedBookingNumbers.add(num);
    return num;
  };

  // ── SESSION 1: برنامج القلق والتوتر — COMPLETED (20 days ago, 10:00 Riyadh) ─
  const s1ScheduledAt = daysAgo(20, 10, 0);
  const s1Duration = 90;
  const s1EndsAt = endsAt(s1ScheduledAt, s1Duration);

  const session1 = await prisma.groupSession.create({
    data: {
      id: SESSION_IDS[0],
      branchId: branch.id,
      employeeId: employee.id,
      serviceId: service.id,
      title: 'برنامج القلق والتوتر',
      descriptionAr: 'برنامج متخصص للتعامل مع القلق والتوتر وتطوير مهارات إدارة الضغوط النفسية.',
      scheduledAt: s1ScheduledAt,
      durationMins: s1Duration,
      maxCapacity: 8,
      enrolledCount: 4, // 3 COMPLETED + 1 NO_SHOW (cancelled does NOT count)
      price: 16000,
      currency: 'SAR',
      status: 'COMPLETED',
      deliveryType: 'IN_PERSON',
      isPublic: true,
      publicDescriptionAr: 'جلسة جماعية لمواجهة القلق والتوتر في بيئة داعمة.',
    },
  });
  console.log(`Created session 1: ${session1.title}`);

  // 3x COMPLETED
  for (let i = 0; i < 3; i++) {
    const bkScheduledAt = s1ScheduledAt;
    const bkEndsAt = s1EndsAt;
    const bk = await prisma.booking.create({
      data: {
        bookingNumber: await getBookingNumber(),
        branchId: branch.id,
        clientId: clients[i].id,
        employeeId: employee.id,
        serviceId: service.id,
        bookingType: 'GROUP',
        deliveryType: 'IN_PERSON',
        source: 'RECEPTION',
        status: 'COMPLETED',
        scheduledAt: bkScheduledAt,
        endsAt: bkEndsAt,
        durationMins: s1Duration,
        price: 16000,
        currency: 'SAR',
        groupSessionId: session1.id,
        confirmedAt: new Date(bkScheduledAt.getTime() - 2 * 24 * 60 * 60 * 1000),
        checkedInAt: bkScheduledAt,
        completedAt: bkEndsAt,
      },
    });
    await prisma.groupEnrollment.create({
      data: {
        groupSessionId: session1.id,
        clientId: clients[i].id,
        bookingId: bk.id,
        enrolledAt: new Date(bkScheduledAt.getTime() - 3 * 24 * 60 * 60 * 1000),
      },
    });
  }

  // 1x NO_SHOW
  const bkNoShow1 = await prisma.booking.create({
    data: {
      bookingNumber: await getBookingNumber(),
      branchId: branch.id,
      clientId: clients[3].id,
      employeeId: employee.id,
      serviceId: service.id,
      bookingType: 'GROUP',
      deliveryType: 'IN_PERSON',
      source: 'RECEPTION',
      status: 'NO_SHOW',
      scheduledAt: s1ScheduledAt,
      endsAt: s1EndsAt,
      durationMins: s1Duration,
      price: 16000,
      currency: 'SAR',
      groupSessionId: session1.id,
      confirmedAt: new Date(s1ScheduledAt.getTime() - 2 * 24 * 60 * 60 * 1000),
      noShowAt: new Date(s1ScheduledAt.getTime() + 15 * 60 * 1000),
    },
  });
  await prisma.groupEnrollment.create({
    data: {
      groupSessionId: session1.id,
      clientId: clients[3].id,
      bookingId: bkNoShow1.id,
      enrolledAt: new Date(s1ScheduledAt.getTime() - 3 * 24 * 60 * 60 * 1000),
    },
  });

  // 1x CANCELLED (does NOT count toward enrolledCount)
  await prisma.booking.create({
    data: {
      bookingNumber: await getBookingNumber(),
      branchId: branch.id,
      clientId: clients[4].id,
      employeeId: employee.id,
      serviceId: service.id,
      bookingType: 'GROUP',
      deliveryType: 'IN_PERSON',
      source: 'ONLINE',
      status: 'CANCELLED',
      scheduledAt: s1ScheduledAt,
      endsAt: s1EndsAt,
      durationMins: s1Duration,
      price: 16000,
      currency: 'SAR',
      groupSessionId: session1.id,
      cancelledAt: new Date(s1ScheduledAt.getTime() - 5 * 24 * 60 * 60 * 1000),
      cancelReason: 'CLIENT_REQUESTED',
    },
  });
  // No GroupEnrollment for cancelled booking
  console.log('  Session 1: 5 bookings created (3 COMPLETED, 1 NO_SHOW, 1 CANCELLED)');

  // ── SESSION 2: مجموعة دعم الأمهات — COMPLETED (10 days ago, 17:00 Riyadh) ──
  const s2ScheduledAt = daysAgo(10, 17, 0);
  const s2Duration = 75;
  const s2EndsAt = endsAt(s2ScheduledAt, s2Duration);

  const session2 = await prisma.groupSession.create({
    data: {
      id: SESSION_IDS[1],
      branchId: branch.id,
      employeeId: employee.id,
      serviceId: service.id,
      title: 'مجموعة دعم الأمهات',
      descriptionAr: 'مجموعة دعم مخصصة للأمهات الجدد للتعامل مع تحديات الأمومة والرعاية النفسية.',
      scheduledAt: s2ScheduledAt,
      durationMins: s2Duration,
      maxCapacity: 6,
      enrolledCount: 5, // 4 COMPLETED + 1 NO_SHOW
      price: 12000,
      currency: 'SAR',
      status: 'COMPLETED',
      deliveryType: 'ONLINE',
      isPublic: true,
      publicDescriptionAr: 'جلسة دعم للأمهات الجدد عبر الإنترنت.',
    },
  });
  console.log(`Created session 2: ${session2.title}`);

  // 4x COMPLETED
  for (let i = 0; i < 4; i++) {
    const bk = await prisma.booking.create({
      data: {
        bookingNumber: await getBookingNumber(),
        branchId: branch.id,
        clientId: clients[i].id,
        employeeId: employee.id,
        serviceId: service.id,
        bookingType: 'GROUP',
        deliveryType: 'ONLINE',
        source: 'ONLINE',
        status: 'COMPLETED',
        scheduledAt: s2ScheduledAt,
        endsAt: s2EndsAt,
        durationMins: s2Duration,
        price: 12000,
        currency: 'SAR',
        groupSessionId: session2.id,
        confirmedAt: new Date(s2ScheduledAt.getTime() - 2 * 24 * 60 * 60 * 1000),
        checkedInAt: s2ScheduledAt,
        completedAt: s2EndsAt,
      },
    });
    await prisma.groupEnrollment.create({
      data: {
        groupSessionId: session2.id,
        clientId: clients[i].id,
        bookingId: bk.id,
        enrolledAt: new Date(s2ScheduledAt.getTime() - 4 * 24 * 60 * 60 * 1000),
      },
    });
  }

  // 1x NO_SHOW
  const bkNoShow2 = await prisma.booking.create({
    data: {
      bookingNumber: await getBookingNumber(),
      branchId: branch.id,
      clientId: clients[4].id,
      employeeId: employee.id,
      serviceId: service.id,
      bookingType: 'GROUP',
      deliveryType: 'ONLINE',
      source: 'ONLINE',
      status: 'NO_SHOW',
      scheduledAt: s2ScheduledAt,
      endsAt: s2EndsAt,
      durationMins: s2Duration,
      price: 12000,
      currency: 'SAR',
      groupSessionId: session2.id,
      confirmedAt: new Date(s2ScheduledAt.getTime() - 1 * 24 * 60 * 60 * 1000),
      noShowAt: new Date(s2ScheduledAt.getTime() + 10 * 60 * 1000),
    },
  });
  await prisma.groupEnrollment.create({
    data: {
      groupSessionId: session2.id,
      clientId: clients[4].id,
      bookingId: bkNoShow2.id,
      enrolledAt: new Date(s2ScheduledAt.getTime() - 4 * 24 * 60 * 60 * 1000),
    },
  });
  console.log('  Session 2: 5 bookings created (4 COMPLETED, 1 NO_SHOW)');

  // ── SESSION 3: دائرة التعافي الأسبوعية — OPEN (5 days ahead, 18:00 Riyadh) ─
  const s3ScheduledAt = daysAhead(5, 18, 0);
  const s3Duration = 90;
  const s3EndsAt = endsAt(s3ScheduledAt, s3Duration);

  const session3 = await prisma.groupSession.create({
    data: {
      id: SESSION_IDS[2],
      branchId: branch.id,
      employeeId: employee.id,
      serviceId: service.id,
      title: 'دائرة التعافي الأسبوعية',
      descriptionAr: 'جلسة أسبوعية مستمرة للدعم المتبادل في رحلة التعافي.',
      scheduledAt: s3ScheduledAt,
      durationMins: s3Duration,
      maxCapacity: 10,
      enrolledCount: 5, // 4 CONFIRMED + 1 AWAITING_PAYMENT (cancelled does NOT count)
      price: 20000,
      currency: 'SAR',
      status: 'OPEN',
      deliveryType: 'IN_PERSON',
      isPublic: true,
      publicDescriptionAr: 'دائرة تعافي أسبوعية مفتوحة للمشاركة.',
    },
  });
  console.log(`Created session 3: ${session3.title}`);

  // 4x CONFIRMED
  for (let i = 0; i < 4; i++) {
    const bk = await prisma.booking.create({
      data: {
        bookingNumber: await getBookingNumber(),
        branchId: branch.id,
        clientId: clients[i].id,
        employeeId: employee.id,
        serviceId: service.id,
        bookingType: 'GROUP',
        deliveryType: 'IN_PERSON',
        source: 'ONLINE',
        status: 'CONFIRMED',
        scheduledAt: s3ScheduledAt,
        endsAt: s3EndsAt,
        durationMins: s3Duration,
        price: 20000,
        currency: 'SAR',
        groupSessionId: session3.id,
        confirmedAt: new Date(BASE.getTime() - 2 * 24 * 60 * 60 * 1000),
      },
    });
    await prisma.groupEnrollment.create({
      data: {
        groupSessionId: session3.id,
        clientId: clients[i].id,
        bookingId: bk.id,
        enrolledAt: new Date(BASE.getTime() - 3 * 24 * 60 * 60 * 1000),
      },
    });
  }

  // 1x AWAITING_PAYMENT
  const bkAwait3 = await prisma.booking.create({
    data: {
      bookingNumber: await getBookingNumber(),
      branchId: branch.id,
      clientId: clients[4].id,
      employeeId: employee.id,
      serviceId: service.id,
      bookingType: 'GROUP',
      deliveryType: 'IN_PERSON',
      source: 'ONLINE',
      status: 'AWAITING_PAYMENT',
      scheduledAt: s3ScheduledAt,
      endsAt: s3EndsAt,
      durationMins: s3Duration,
      price: 20000,
      currency: 'SAR',
      groupSessionId: session3.id,
    },
  });
  await prisma.groupEnrollment.create({
    data: {
      groupSessionId: session3.id,
      clientId: clients[4].id,
      bookingId: bkAwait3.id,
      enrolledAt: new Date(BASE.getTime() - 1 * 24 * 60 * 60 * 1000),
    },
  });

  // 1x CANCELLED (does NOT count)
  await prisma.booking.create({
    data: {
      bookingNumber: await getBookingNumber(),
      branchId: branch.id,
      clientId: clients[5].id,
      employeeId: employee.id,
      serviceId: service.id,
      bookingType: 'GROUP',
      deliveryType: 'IN_PERSON',
      source: 'ONLINE',
      status: 'CANCELLED',
      scheduledAt: s3ScheduledAt,
      endsAt: s3EndsAt,
      durationMins: s3Duration,
      price: 20000,
      currency: 'SAR',
      groupSessionId: session3.id,
      cancelledAt: new Date(BASE.getTime() - 1 * 24 * 60 * 60 * 1000),
      cancelReason: 'CLIENT_REQUESTED',
    },
  });
  console.log(
    '  Session 3: 6 bookings created (4 CONFIRMED, 1 AWAITING_PAYMENT, 1 CANCELLED)',
  );

  // ── SESSION 4: جلسة التعامل مع الضغوط — OPEN (12 days ahead, 19:00 Riyadh) ─
  const s4ScheduledAt = daysAhead(12, 19, 0);
  const s4Duration = 60;
  const s4EndsAt = endsAt(s4ScheduledAt, s4Duration);

  const session4 = await prisma.groupSession.create({
    data: {
      id: SESSION_IDS[3],
      branchId: branch.id,
      employeeId: employee.id,
      serviceId: service.id,
      title: 'جلسة التعامل مع الضغوط',
      descriptionAr: 'تعلّم تقنيات فعّالة للتعامل مع ضغوط العمل والحياة اليومية.',
      scheduledAt: s4ScheduledAt,
      durationMins: s4Duration,
      maxCapacity: 8,
      enrolledCount: 4, // 2 CONFIRMED + 1 PENDING_GROUP_FILL + 1 AWAITING_PAYMENT (cancelled does NOT count)
      price: 15000,
      currency: 'SAR',
      status: 'OPEN',
      deliveryType: 'IN_PERSON',
      isPublic: false,
    },
  });
  console.log(`Created session 4: ${session4.title}`);

  // 2x CONFIRMED
  for (let i = 0; i < 2; i++) {
    const bk = await prisma.booking.create({
      data: {
        bookingNumber: await getBookingNumber(),
        branchId: branch.id,
        clientId: clients[i].id,
        employeeId: employee.id,
        serviceId: service.id,
        bookingType: 'GROUP',
        deliveryType: 'IN_PERSON',
        source: 'RECEPTION',
        status: 'CONFIRMED',
        scheduledAt: s4ScheduledAt,
        endsAt: s4EndsAt,
        durationMins: s4Duration,
        price: 15000,
        currency: 'SAR',
        groupSessionId: session4.id,
        confirmedAt: new Date(BASE.getTime() - 1 * 24 * 60 * 60 * 1000),
      },
    });
    await prisma.groupEnrollment.create({
      data: {
        groupSessionId: session4.id,
        clientId: clients[i].id,
        bookingId: bk.id,
        enrolledAt: new Date(BASE.getTime() - 2 * 24 * 60 * 60 * 1000),
      },
    });
  }

  // 1x PENDING_GROUP_FILL
  const bkPending = await prisma.booking.create({
    data: {
      bookingNumber: await getBookingNumber(),
      branchId: branch.id,
      clientId: clients[2].id,
      employeeId: employee.id,
      serviceId: service.id,
      bookingType: 'GROUP',
      deliveryType: 'IN_PERSON',
      source: 'ONLINE',
      status: 'PENDING_GROUP_FILL',
      scheduledAt: s4ScheduledAt,
      endsAt: s4EndsAt,
      durationMins: s4Duration,
      price: 15000,
      currency: 'SAR',
      groupSessionId: session4.id,
    },
  });
  await prisma.groupEnrollment.create({
    data: {
      groupSessionId: session4.id,
      clientId: clients[2].id,
      bookingId: bkPending.id,
      enrolledAt: BASE,
    },
  });

  // 1x AWAITING_PAYMENT
  const bkAwait4 = await prisma.booking.create({
    data: {
      bookingNumber: await getBookingNumber(),
      branchId: branch.id,
      clientId: clients[3].id,
      employeeId: employee.id,
      serviceId: service.id,
      bookingType: 'GROUP',
      deliveryType: 'IN_PERSON',
      source: 'ONLINE',
      status: 'AWAITING_PAYMENT',
      scheduledAt: s4ScheduledAt,
      endsAt: s4EndsAt,
      durationMins: s4Duration,
      price: 15000,
      currency: 'SAR',
      groupSessionId: session4.id,
    },
  });
  await prisma.groupEnrollment.create({
    data: {
      groupSessionId: session4.id,
      clientId: clients[3].id,
      bookingId: bkAwait4.id,
      enrolledAt: BASE,
    },
  });

  // 1x CANCELLED (does NOT count)
  await prisma.booking.create({
    data: {
      bookingNumber: await getBookingNumber(),
      branchId: branch.id,
      clientId: clients[4].id,
      employeeId: employee.id,
      serviceId: service.id,
      bookingType: 'GROUP',
      deliveryType: 'IN_PERSON',
      source: 'RECEPTION',
      status: 'CANCELLED',
      scheduledAt: s4ScheduledAt,
      endsAt: s4EndsAt,
      durationMins: s4Duration,
      price: 15000,
      currency: 'SAR',
      groupSessionId: session4.id,
      cancelledAt: BASE,
      cancelReason: 'OTHER',
    },
  });
  console.log(
    '  Session 4: 5 bookings created (2 CONFIRMED, 1 PENDING_GROUP_FILL, 1 AWAITING_PAYMENT, 1 CANCELLED)',
  );

  // ── Summary ────────────────────────────────────────────────────────────────
  const sessionCount = await prisma.groupSession.count({
    where: { id: { in: [...SESSION_IDS] } },
  });
  const bookingCount = await prisma.booking.count({
    where: { groupSessionId: { in: [...SESSION_IDS] } },
  });
  const enrollmentCount = await prisma.groupEnrollment.count({
    where: { groupSessionId: { in: [...SESSION_IDS] } },
  });

  console.log(`\n✓ Group sessions seed complete:`);
  console.log(`  ${sessionCount} GroupSession records`);
  console.log(`  ${bookingCount} Booking records (bookingType=GROUP)`);
  console.log(`  ${enrollmentCount} GroupEnrollment records`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
