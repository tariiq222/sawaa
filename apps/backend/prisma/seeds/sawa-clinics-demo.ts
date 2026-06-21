/**
 * Demo seed: Sawa clinics — 6 categories, 9 services, 6 employees, 18 clients, ~24 bookings, 5 ratings.
 * Idempotent: clears all seeded tables before re-creating data.
 *
 * Run: npm run seed:clinics-demo
 */

import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const DEFAULT_BRANCH_ID = 'c1b2c3d4-e5f6-4a5b-8c9d-e0f1a2b3c4d5';

const BASE = new Date('2026-06-19T00:00:00.000Z');

function daysAgo(n: number, hour: number, minute = 0): Date {
  const d = new Date(BASE);
  d.setDate(d.getDate() - n);
  d.setUTCHours(hour - 3, minute, 0, 0); // Riyadh (UTC+3) → UTC
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

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });
  await prisma.$connect();

  // ── Cleanup ────────────────────────────────────────────────────────────────
  await prisma.rating.deleteMany({});
  await prisma.groupEnrollment.deleteMany({});
  await prisma.bookingStatusLog.deleteMany({});
  await prisma.booking.deleteMany({});
  await prisma.groupSession.deleteMany({});
  await prisma.employeeService.deleteMany({});
  await prisma.employeeAvailabilityException.deleteMany({});
  await prisma.employeeAvailability.deleteMany({});
  await prisma.employeeBranch.deleteMany({});
  await prisma.employee.deleteMany({});
  await prisma.serviceBookingConfig.deleteMany({});
  await prisma.serviceAvailabilityWindow.deleteMany({});
  await prisma.serviceDurationOption.deleteMany({});
  await prisma.service.deleteMany({});
  await prisma.serviceCategory.deleteMany({});
  await prisma.client.deleteMany({});
  console.log('Cleanup done');

  // ── Department upsert ──────────────────────────────────────────────────────
  const dept = await prisma.department.upsert({
    where: { nameAr: 'عيادات سواء' },
    update: {},
    create: { nameAr: 'عيادات سواء', nameEn: 'Sawa Clinics' },
  });
  const departmentId = dept.id;

  // ── Service Categories (6 clinics) ─────────────────────────────────────────
  const categoryDefs = [
    { nameAr: 'عيادة الاستشارات الأسرية', nameEn: 'Family Counseling' },
    { nameAr: 'عيادة الاستشارات الزوجية', nameEn: 'Marriage Counseling' },
    { nameAr: 'عيادة الإرشاد النفسي', nameEn: 'Psychological Counseling' },
    { nameAr: 'عيادة إرشاد الأطفال والمراهقين', nameEn: 'Child & Adolescent Counseling' },
    { nameAr: 'عيادة التعافي من الإدمان', nameEn: 'Addiction Recovery' },
    { nameAr: 'عيادة الصحة النفسية', nameEn: 'Mental Health' },
  ];

  const categories: { id: string }[] = [];
  for (const def of categoryDefs) {
    const cat = await prisma.serviceCategory.create({
      data: {
        nameAr: def.nameAr,
        nameEn: def.nameEn,
        departmentId,
        bookingMode: 'SERVICES',
        sortOrder: 0,
        isActive: true,
      },
    });
    categories.push({ id: cat.id });
  }

  const [cat1, cat2, cat3, cat4, cat5, cat6] = categories;

  // ── Services ───────────────────────────────────────────────────────────────
  // Clinic 1 — أسرية
  const svc1 = await prisma.service.create({
    data: {
      nameAr: 'جلسة إرشاد أسري',
      nameEn: 'Family Session',
      durationMins: 60,
      price: 30000,
      currency: 'SAR',
      categoryId: cat1.id,
      isActive: true,
      bookingConfigs: {
        create: [
          { deliveryType: 'IN_PERSON', price: 30000, durationMins: 60, isActive: true },
          { deliveryType: 'ONLINE', price: 30000, durationMins: 60, isActive: true },
        ],
      },
    },
  });

  // Clinic 2 — زوجية
  const svc2 = await prisma.service.create({
    data: {
      nameAr: 'جلسة استشارة زوجية',
      nameEn: 'Marriage Counseling Session',
      durationMins: 60,
      price: 35000,
      currency: 'SAR',
      categoryId: cat2.id,
      isActive: true,
      bookingConfigs: {
        create: [
          { deliveryType: 'IN_PERSON', price: 35000, durationMins: 60, isActive: true },
          { deliveryType: 'ONLINE', price: 35000, durationMins: 60, isActive: true },
        ],
      },
    },
  });

  // Clinic 3 — نفسي
  const svc3 = await prisma.service.create({
    data: {
      nameAr: 'جلسة إرشاد نفسي',
      nameEn: 'Psychological Counseling Session',
      durationMins: 50,
      price: 28000,
      currency: 'SAR',
      categoryId: cat3.id,
      isActive: true,
      bookingConfigs: {
        create: [
          { deliveryType: 'IN_PERSON', price: 28000, durationMins: 50, isActive: true },
          { deliveryType: 'ONLINE', price: 28000, durationMins: 50, isActive: true },
        ],
      },
    },
  });

  // Clinic 4 — أطفال
  const svc4 = await prisma.service.create({
    data: {
      nameAr: 'جلسة إرشاد الطفل',
      nameEn: 'Child Counseling Session',
      durationMins: 45,
      price: 25000,
      currency: 'SAR',
      categoryId: cat4.id,
      isActive: true,
      bookingConfigs: {
        create: [
          { deliveryType: 'IN_PERSON', price: 25000, durationMins: 45, isActive: true },
          { deliveryType: 'ONLINE', price: 25000, durationMins: 45, isActive: true },
        ],
      },
    },
  });

  // Clinic 5 — إدمان
  const svc5 = await prisma.service.create({
    data: {
      nameAr: 'جلسة دعم التعافي',
      nameEn: 'Addiction Recovery Session',
      durationMins: 60,
      price: 30000,
      currency: 'SAR',
      categoryId: cat5.id,
      isActive: true,
      bookingConfigs: {
        create: [
          { deliveryType: 'IN_PERSON', price: 30000, durationMins: 60, isActive: true },
          { deliveryType: 'ONLINE', price: 30000, durationMins: 60, isActive: true },
        ],
      },
    },
  });

  // Clinic 6 — صحة نفسية (4 services)
  const svc6a = await prisma.service.create({
    data: {
      nameAr: 'تقييم نفسي أولي',
      nameEn: 'Initial Psychological Assessment',
      durationMins: 60,
      price: 40000,
      currency: 'SAR',
      categoryId: cat6.id,
      isActive: true,
      bookingConfigs: {
        create: [
          { deliveryType: 'IN_PERSON', price: 40000, durationMins: 60, isActive: true },
          { deliveryType: 'ONLINE', price: 40000, durationMins: 60, isActive: true },
        ],
      },
    },
  });

  const svc6b = await prisma.service.create({
    data: {
      nameAr: 'جلسة علاج معرفي سلوكي',
      nameEn: 'CBT Session',
      durationMins: 50,
      price: 32000,
      currency: 'SAR',
      categoryId: cat6.id,
      isActive: true,
      bookingConfigs: {
        create: [
          { deliveryType: 'IN_PERSON', price: 32000, durationMins: 50, isActive: true },
          { deliveryType: 'ONLINE', price: 32000, durationMins: 50, isActive: true },
        ],
      },
    },
  });

  const svc6c = await prisma.service.create({
    data: {
      nameAr: 'جلسة متابعة',
      nameEn: 'Follow-up Session',
      durationMins: 30,
      price: 18000,
      currency: 'SAR',
      categoryId: cat6.id,
      isActive: true,
      bookingConfigs: {
        create: [
          { deliveryType: 'IN_PERSON', price: 18000, durationMins: 30, isActive: true },
          { deliveryType: 'ONLINE', price: 18000, durationMins: 30, isActive: true },
        ],
      },
    },
  });

  const svc6d = await prisma.service.create({
    data: {
      nameAr: 'استشارة سريعة',
      nameEn: 'Quick Consult',
      durationMins: 20,
      price: 12000,
      currency: 'SAR',
      categoryId: cat6.id,
      isActive: true,
      bookingConfigs: {
        create: [
          { deliveryType: 'IN_PERSON', price: 12000, durationMins: 20, isActive: true },
          { deliveryType: 'ONLINE', price: 12000, durationMins: 20, isActive: true },
        ],
      },
    },
  });

  // ── Employees ──────────────────────────────────────────────────────────────
  async function createEmployee(data: {
    name: string;
    nameAr: string;
    title: string;
    gender: 'MALE' | 'FEMALE';
    specialty: string;
    experience: number;
    email: string;
    phone: string;
  }) {
    return prisma.employee.create({
      data: {
        name: data.name,
        nameAr: data.nameAr,
        title: data.title,
        gender: data.gender,
        specialty: data.specialty,
        experience: data.experience,
        email: data.email,
        phone: data.phone,
        employmentType: 'FULL_TIME',
        onboardingStatus: 'COMPLETED',
        isActive: true,
      },
    });
  }

  const salman = await createEmployee({
    name: 'Salman Al-Rashed',
    nameAr: 'سلمان الراشد',
    title: 'استشاري إرشاد أسري',
    gender: 'MALE',
    specialty: 'Family & Marriage Counseling',
    experience: 12,
    email: 'salman.alrashed@sawaa.local',
    phone: '+966551234001',
  });

  const mona = await createEmployee({
    name: 'Mona Al-Otaibi',
    nameAr: 'منى العتيبي',
    title: 'أخصائية نفسية',
    gender: 'FEMALE',
    specialty: 'Psychological Counseling',
    experience: 8,
    email: 'mona.alotaibi@sawaa.local',
    phone: '+966551234002',
  });

  const khalid = await createEmployee({
    name: 'Khalid Al-Dosari',
    nameAr: 'خالد الدوسري',
    title: 'استشاري نفسي',
    gender: 'MALE',
    specialty: 'Mental Health & Addiction',
    experience: 15,
    email: 'khalid.aldosari@sawaa.local',
    phone: '+966551234003',
  });

  const hind = await createEmployee({
    name: 'Hind Al-Shahri',
    nameAr: 'هند الشهري',
    title: 'أخصائية إرشاد أطفال',
    gender: 'FEMALE',
    specialty: 'Child & Adolescent Counseling',
    experience: 6,
    email: 'hind.alshahri@sawaa.local',
    phone: '+966551234004',
  });

  const fahad = await createEmployee({
    name: 'Fahad Al-Qahtani',
    nameAr: 'فهد القحطاني',
    title: 'أخصائي علاج إدمان',
    gender: 'MALE',
    specialty: 'Addiction Recovery',
    experience: 10,
    email: 'fahad.alqahtani@sawaa.local',
    phone: '+966551234005',
  });

  const reem = await createEmployee({
    name: 'Reem Al-Zahrani',
    nameAr: 'ريم الزهراني',
    title: 'أخصائية علاقات زوجية',
    gender: 'FEMALE',
    specialty: 'Marriage & Family Therapy',
    experience: 9,
    email: 'reem.alzahrani@sawaa.local',
    phone: '+966551234006',
  });

  const employees = [salman, mona, khalid, hind, fahad, reem];

  // EmployeeBranch + EmployeeAvailability for all employees
  for (const emp of employees) {
    await prisma.employeeBranch.create({
      data: { employeeId: emp.id, branchId: DEFAULT_BRANCH_ID },
    });
    for (const day of [0, 1, 2, 3, 4]) {
      await prisma.employeeAvailability.create({
        data: {
          employeeId: emp.id,
          dayOfWeek: day,
          startTime: '09:00',
          endTime: '17:00',
          isActive: true,
        },
      });
    }
  }

  // EmployeeService assignments
  const employeeServicePairs: { employeeId: string; serviceId: string }[] = [
    // Salman: clinic1, clinic2
    { employeeId: salman.id, serviceId: svc1.id },
    { employeeId: salman.id, serviceId: svc2.id },
    // Mona: clinic3, all 4 of clinic6
    { employeeId: mona.id, serviceId: svc3.id },
    { employeeId: mona.id, serviceId: svc6a.id },
    { employeeId: mona.id, serviceId: svc6b.id },
    { employeeId: mona.id, serviceId: svc6c.id },
    { employeeId: mona.id, serviceId: svc6d.id },
    // Khalid: clinic6_assessment, clinic6_cbt, clinic5
    { employeeId: khalid.id, serviceId: svc6a.id },
    { employeeId: khalid.id, serviceId: svc6b.id },
    { employeeId: khalid.id, serviceId: svc5.id },
    // Hind: clinic4
    { employeeId: hind.id, serviceId: svc4.id },
    // Fahad: clinic5
    { employeeId: fahad.id, serviceId: svc5.id },
    // Reem: clinic2, clinic1
    { employeeId: reem.id, serviceId: svc2.id },
    { employeeId: reem.id, serviceId: svc1.id },
  ];

  for (const pair of employeeServicePairs) {
    await prisma.employeeService.create({
      data: { employeeId: pair.employeeId, serviceId: pair.serviceId, isActive: true },
    });
  }

  // ── Clients (18) ───────────────────────────────────────────────────────────
  const clientDefs = [
    { name: 'عبدالله المطيري', firstName: 'عبدالله', lastName: 'المطيري', gender: 'MALE' as const, phone: '+966501234001', email: 'abdullah.mutairi@email.com', accountType: 'FULL' as const, source: 'ONLINE' as const, emailVerified: new Date() },
    { name: 'فاطمة العنزي', firstName: 'فاطمة', lastName: 'العنزي', gender: 'FEMALE' as const, phone: '+966501234002', email: 'fatima.anazi@email.com', accountType: 'FULL' as const, source: 'ONLINE' as const, emailVerified: new Date() },
    { name: 'محمد الحربي', firstName: 'محمد', lastName: 'الحربي', gender: 'MALE' as const, phone: '+966501234003', email: null, accountType: 'FULL' as const, source: 'REFERRAL' as const, emailVerified: null },
    { name: 'نورة السبيعي', firstName: 'نورة', lastName: 'السبيعي', gender: 'FEMALE' as const, phone: '+966501234004', email: 'noura.subai@email.com', accountType: 'FULL' as const, source: 'ONLINE' as const, emailVerified: new Date() },
    { name: 'خالد الشمري', firstName: 'خالد', lastName: 'الشمري', gender: 'MALE' as const, phone: '+966501234005', email: null, accountType: 'FULL' as const, source: 'REFERRAL' as const, emailVerified: null },
    { name: 'هيا الغامدي', firstName: 'هيا', lastName: 'الغامدي', gender: 'FEMALE' as const, phone: '+966501234006', email: 'haya.ghamdi@email.com', accountType: 'FULL' as const, source: 'ONLINE' as const, emailVerified: new Date() },
    { name: 'سعد الرشيدي', firstName: 'سعد', lastName: 'الرشيدي', gender: 'MALE' as const, phone: '+966501234007', email: null, accountType: 'WALK_IN' as const, source: 'WALK_IN' as const, emailVerified: null },
    { name: 'منيرة القرني', firstName: 'منيرة', lastName: 'القرني', gender: 'FEMALE' as const, phone: '+966501234008', email: 'muneera.qarni@email.com', accountType: 'FULL' as const, source: 'ONLINE' as const, emailVerified: new Date() },
    { name: 'عمر الجهني', firstName: 'عمر', lastName: 'الجهني', gender: 'MALE' as const, phone: '+966501234009', email: null, accountType: 'WALK_IN' as const, source: 'WALK_IN' as const, emailVerified: null },
    { name: 'ريم العسيري', firstName: 'ريم', lastName: 'العسيري', gender: 'FEMALE' as const, phone: '+966501234010', email: 'reem.asiri@email.com', accountType: 'FULL' as const, source: 'REFERRAL' as const, emailVerified: new Date() },
    { name: 'بندر المالكي', firstName: 'بندر', lastName: 'المالكي', gender: 'MALE' as const, phone: '+966501234011', email: null, accountType: 'FULL' as const, source: 'REFERRAL' as const, emailVerified: null },
    { name: 'سارة الزهراني', firstName: 'سارة', lastName: 'الزهراني', gender: 'FEMALE' as const, phone: '+966501234012', email: 'sara.zahrani@email.com', accountType: 'FULL' as const, source: 'ONLINE' as const, emailVerified: new Date() },
    { name: 'يوسف الدوسري', firstName: 'يوسف', lastName: 'الدوسري', gender: 'MALE' as const, phone: '+966501234013', email: null, accountType: 'WALK_IN' as const, source: 'WALK_IN' as const, emailVerified: null },
    { name: 'أميرة الشهري', firstName: 'أميرة', lastName: 'الشهري', gender: 'FEMALE' as const, phone: '+966501234014', email: 'amira.shahri@email.com', accountType: 'FULL' as const, source: 'ONLINE' as const, emailVerified: new Date() },
    { name: 'وليد القحطاني', firstName: 'وليد', lastName: 'القحطاني', gender: 'MALE' as const, phone: '+966501234015', email: null, accountType: 'WALK_IN' as const, source: 'WALK_IN' as const, emailVerified: null },
    { name: 'لمياء العتيبي', firstName: 'لمياء', lastName: 'العتيبي', gender: 'FEMALE' as const, phone: '+966501234016', email: 'lamya.otaibi@email.com', accountType: 'FULL' as const, source: 'ONLINE' as const, emailVerified: new Date() },
    { name: 'تركي السلمي', firstName: 'تركي', lastName: 'السلمي', gender: 'MALE' as const, phone: '+966501234017', email: null, accountType: 'FULL' as const, source: 'REFERRAL' as const, emailVerified: null },
    { name: 'شيماء الحربي', firstName: 'شيماء', lastName: 'الحربي', gender: 'FEMALE' as const, phone: '+966501234018', email: 'shaima.harbi@email.com', accountType: 'FULL' as const, source: 'ONLINE' as const, emailVerified: new Date() },
  ];

  const clients: { id: string }[] = [];
  for (const def of clientDefs) {
    const c = await prisma.client.create({
      data: {
        name: def.name,
        firstName: def.firstName,
        lastName: def.lastName,
        gender: def.gender,
        phone: def.phone,
        email: def.email,
        accountType: def.accountType,
        source: def.source,
        emailVerified: def.emailVerified,
        isActive: true,
      },
    });
    clients.push({ id: c.id });
  }

  const [c1, c2, c3, c4, c5, c6, c7, c8, c9, c10, c11, c12, c13, c14, c15, c16, c17, c18] = clients;

  // ── Bookings (~24) ─────────────────────────────────────────────────────────
  const bookingDefs = [
    // Clinic 1 — أسرية (svc1, 60min, 30000)
    { num: 1001, clientId: c1.id, employeeId: salman.id, serviceId: svc1.id, deliveryType: 'IN_PERSON' as const, bookingType: 'INDIVIDUAL' as const, status: 'COMPLETED' as const, scheduledAt: daysAgo(12, 10), durationMins: 60, price: 30000 },
    { num: 1002, clientId: c6.id, employeeId: reem.id, serviceId: svc1.id, deliveryType: 'IN_PERSON' as const, bookingType: 'INDIVIDUAL' as const, status: 'COMPLETED' as const, scheduledAt: daysAgo(8, 11), durationMins: 60, price: 30000 },
    { num: 1003, clientId: c11.id, employeeId: salman.id, serviceId: svc1.id, deliveryType: 'IN_PERSON' as const, bookingType: 'INDIVIDUAL' as const, status: 'CONFIRMED' as const, scheduledAt: daysAhead(2, 14), durationMins: 60, price: 30000 },
    { num: 1004, clientId: c16.id, employeeId: reem.id, serviceId: svc1.id, deliveryType: 'ONLINE' as const, bookingType: 'INDIVIDUAL' as const, status: 'CANCELLED' as const, scheduledAt: daysAgo(5, 9), durationMins: 60, price: 30000 },

    // Clinic 2 — زوجية (svc2, 60min, 35000)
    { num: 1005, clientId: c2.id, employeeId: salman.id, serviceId: svc2.id, deliveryType: 'IN_PERSON' as const, bookingType: 'INDIVIDUAL' as const, status: 'COMPLETED' as const, scheduledAt: daysAgo(10, 10), durationMins: 60, price: 35000 },
    { num: 1006, clientId: c13.id, employeeId: reem.id, serviceId: svc2.id, deliveryType: 'IN_PERSON' as const, bookingType: 'INDIVIDUAL' as const, status: 'NO_SHOW' as const, scheduledAt: daysAgo(6, 11), durationMins: 60, price: 35000 },
    { num: 1007, clientId: c17.id, employeeId: salman.id, serviceId: svc2.id, deliveryType: 'IN_PERSON' as const, bookingType: 'INDIVIDUAL' as const, status: 'CONFIRMED' as const, scheduledAt: daysAhead(3, 15), durationMins: 60, price: 35000 },
    { num: 1008, clientId: c4.id, employeeId: reem.id, serviceId: svc2.id, deliveryType: 'ONLINE' as const, bookingType: 'INDIVIDUAL' as const, status: 'PENDING' as const, scheduledAt: daysAhead(7, 10), durationMins: 60, price: 35000 },

    // Clinic 3 — إرشاد نفسي (svc3, 50min, 28000)
    { num: 1009, clientId: c3.id, employeeId: mona.id, serviceId: svc3.id, deliveryType: 'IN_PERSON' as const, bookingType: 'INDIVIDUAL' as const, status: 'COMPLETED' as const, scheduledAt: daysAgo(11, 9), durationMins: 50, price: 28000 },
    { num: 1010, clientId: c8.id, employeeId: mona.id, serviceId: svc3.id, deliveryType: 'ONLINE' as const, bookingType: 'INDIVIDUAL' as const, status: 'COMPLETED' as const, scheduledAt: daysAgo(4, 14), durationMins: 50, price: 28000 },
    { num: 1011, clientId: c15.id, employeeId: mona.id, serviceId: svc3.id, deliveryType: 'IN_PERSON' as const, bookingType: 'INDIVIDUAL' as const, status: 'AWAITING_PAYMENT' as const, scheduledAt: daysAhead(1, 11), durationMins: 50, price: 28000 },
    { num: 1012, clientId: c18.id, employeeId: mona.id, serviceId: svc3.id, deliveryType: 'IN_PERSON' as const, bookingType: 'WALK_IN' as const, status: 'EXPIRED' as const, scheduledAt: daysAgo(3, 10), durationMins: 50, price: 28000 },

    // Clinic 4 — أطفال (svc4, 45min, 25000)
    { num: 1013, clientId: c5.id, employeeId: hind.id, serviceId: svc4.id, deliveryType: 'IN_PERSON' as const, bookingType: 'INDIVIDUAL' as const, status: 'COMPLETED' as const, scheduledAt: daysAgo(9, 10), durationMins: 45, price: 25000 },
    { num: 1014, clientId: c10.id, employeeId: hind.id, serviceId: svc4.id, deliveryType: 'IN_PERSON' as const, bookingType: 'INDIVIDUAL' as const, status: 'CONFIRMED' as const, scheduledAt: daysAhead(4, 13), durationMins: 45, price: 25000 },
    { num: 1015, clientId: c14.id, employeeId: hind.id, serviceId: svc4.id, deliveryType: 'IN_PERSON' as const, bookingType: 'INDIVIDUAL' as const, status: 'CANCELLED' as const, scheduledAt: daysAgo(2, 9), durationMins: 45, price: 25000 },

    // Clinic 5 — تعافي (svc5, 60min, 30000)
    { num: 1016, clientId: c7.id, employeeId: fahad.id, serviceId: svc5.id, deliveryType: 'IN_PERSON' as const, bookingType: 'INDIVIDUAL' as const, status: 'COMPLETED' as const, scheduledAt: daysAgo(13, 11), durationMins: 60, price: 30000 },
    { num: 1017, clientId: c9.id, employeeId: khalid.id, serviceId: svc5.id, deliveryType: 'IN_PERSON' as const, bookingType: 'WALK_IN' as const, status: 'COMPLETED' as const, scheduledAt: daysAgo(1, 10), durationMins: 60, price: 30000 },
    { num: 1018, clientId: c12.id, employeeId: fahad.id, serviceId: svc5.id, deliveryType: 'IN_PERSON' as const, bookingType: 'INDIVIDUAL' as const, status: 'CONFIRMED' as const, scheduledAt: daysAhead(5, 14), durationMins: 60, price: 30000 },
    { num: 1019, clientId: c15.id, employeeId: khalid.id, serviceId: svc5.id, deliveryType: 'ONLINE' as const, bookingType: 'INDIVIDUAL' as const, status: 'PENDING' as const, scheduledAt: daysAhead(9, 10), durationMins: 60, price: 30000 },

    // Clinic 6 — صحة نفسية
    { num: 1020, clientId: c1.id, employeeId: mona.id, serviceId: svc6a.id, deliveryType: 'IN_PERSON' as const, bookingType: 'INDIVIDUAL' as const, status: 'COMPLETED' as const, scheduledAt: daysAgo(14, 9), durationMins: 60, price: 40000 },
    { num: 1021, clientId: c6.id, employeeId: khalid.id, serviceId: svc6b.id, deliveryType: 'ONLINE' as const, bookingType: 'INDIVIDUAL' as const, status: 'COMPLETED' as const, scheduledAt: daysAgo(7, 13), durationMins: 50, price: 32000 },
    { num: 1022, clientId: c11.id, employeeId: mona.id, serviceId: svc6c.id, deliveryType: 'ONLINE' as const, bookingType: 'INDIVIDUAL' as const, status: 'CONFIRMED' as const, scheduledAt: daysAhead(1, 15), durationMins: 30, price: 18000 },
    { num: 1023, clientId: c16.id, employeeId: khalid.id, serviceId: svc6b.id, deliveryType: 'IN_PERSON' as const, bookingType: 'INDIVIDUAL' as const, status: 'AWAITING_PAYMENT' as const, scheduledAt: daysAhead(6, 11), durationMins: 50, price: 32000 },
    { num: 1024, clientId: c3.id, employeeId: mona.id, serviceId: svc6d.id, deliveryType: 'ONLINE' as const, bookingType: 'INDIVIDUAL' as const, status: 'PENDING' as const, scheduledAt: daysAhead(10, 10), durationMins: 20, price: 12000 },
  ];

  const bookings: { id: string; num: number }[] = [];
  for (const def of bookingDefs) {
    const scheduledAt = def.scheduledAt;
    const b = await prisma.booking.create({
      data: {
        branchId: DEFAULT_BRANCH_ID,
        clientId: def.clientId,
        employeeId: def.employeeId,
        serviceId: def.serviceId,
        deliveryType: def.deliveryType,
        bookingType: def.bookingType,
        status: def.status,
        scheduledAt,
        endsAt: endsAt(scheduledAt, def.durationMins),
        durationMins: def.durationMins,
        price: def.price,
        currency: 'SAR',
        payAtClinic: false,
        bookingNumber: def.num,
      },
    });
    bookings.push({ id: b.id, num: def.num });
  }

  // ── Ratings (5 on completed bookings) ─────────────────────────────────────
  const ratingDefs = [
    { bookingNum: 1001, clientId: c1.id, employeeId: salman.id, score: 5, comment: 'جلسة مثمرة جداً، الاستشاري محترف ومتفهم' },
    { bookingNum: 1005, clientId: c2.id, employeeId: salman.id, score: 5, comment: 'ساعدنا كثيراً في تحسين علاقتنا الزوجية' },
    { bookingNum: 1009, clientId: c3.id, employeeId: mona.id, score: 4, comment: 'خصائصية ممتازة، أسلوبها هادئ ومريح' },
    { bookingNum: 1016, clientId: c7.id, employeeId: fahad.id, score: 5, comment: 'برنامج التعافي غير حياتي، شكراً جزيلاً' },
    { bookingNum: 1021, clientId: c6.id, employeeId: khalid.id, score: 4, comment: 'جلسة CBT مفيدة، تعلمت أدوات عملية جديدة' },
  ];

  for (const def of ratingDefs) {
    const booking = bookings.find((b) => b.num === def.bookingNum);
    if (!booking) throw new Error(`Booking ${def.bookingNum} not found`);
    await prisma.rating.create({
      data: {
        bookingId: booking.id,
        clientId: def.clientId,
        employeeId: def.employeeId,
        score: def.score,
        comment: def.comment,
        isPublic: false,
      },
    });
  }

  // ── Final counts ───────────────────────────────────────────────────────────
  const catCount = await prisma.serviceCategory.count();
  const svcCount = await prisma.service.count();
  const empCount = await prisma.employee.count();
  const cliCount = await prisma.client.count();
  const bkCount = await prisma.booking.count();
  const rtCount = await prisma.rating.count();
  console.log(`Categories: ${catCount}, Services: ${svcCount}, Employees: ${empCount}, Clients: ${cliCount}, Bookings: ${bkCount}, Ratings: ${rtCount}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
