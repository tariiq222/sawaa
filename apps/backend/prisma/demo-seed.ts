/**
 * Demo seed for QA — creates 3 employees, 3 services, 3 clients, and 12 bookings
 * across various statuses/types/dates.
 *
 * Run:  cd apps/backend && npx tsx prisma/demo-seed.ts
 */

import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const BRANCH_ID = 'main-branch';
const BRANCH_ID_2 = '00000000-0000-4000-8000-0000000b0002';
const DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000001';

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });
  await prisma.$connect();

  // Ensure a second branch exists (plan spec: 2+ branches).
  await prisma.branch.upsert({
    where: { id: BRANCH_ID_2 },
    create: {
      id: BRANCH_ID_2,
      organizationId: DEFAULT_ORG_ID,
      nameAr: 'فرع الروضة',
      nameEn: 'Al Rawdah Branch',
      city: 'Riyadh',
      isActive: true,
      isMain: false,
      updatedAt: new Date(),
    },
    update: {},
  });

  const employees: Array<{
    id: string; name: string; nameEn: string; nameAr: string; title: string;
    specialty: string; specialtyAr: string;
    gender: 'MALE' | 'FEMALE'; email: string; phone: string;
    experience: number | null; isActive: boolean;
    extraBranchId?: string;
  }> = [
    // NOTE: do NOT include "د. " / "Dr. " prefixes in name fields — the UI's
    // booking practitioner column auto-prepends `t("bookings.info.drPrefix")`,
    // so a stored "د. خالد" renders as "د. د. خالد". Keep the honorific in
    // `title` only.
    // Original 3 (kept stable for existing bookings/ratings references).
    { id: '00000000-0000-4000-8000-000000000001', name: 'أحمد الغامدي',   nameEn: 'Ahmed Alghamdi',   nameAr: 'أحمد الغامدي',   title: 'طبيب عام',       specialty: 'General',      specialtyAr: 'طب عام',  gender: 'MALE',   email: 'ahmed@deqah-test.com',   phone: '+966500000001', experience: 12, isActive: true  },
    { id: '00000000-0000-4000-8000-000000000002', name: 'فاطمة القحطاني', nameEn: 'Fatima Alqahtani', nameAr: 'فاطمة القحطاني', title: 'أخصائية جلدية', specialty: 'Dermatology',  specialtyAr: 'جلدية',   gender: 'FEMALE', email: 'fatima@deqah-test.com',  phone: '+966500000002', experience: 8,  isActive: true  },
    { id: '00000000-0000-4000-8000-000000000003', name: 'خالد السبيعي',   nameEn: 'Khalid Alsubaie',  nameAr: 'خالد السبيعي',   title: 'أخصائي أسنان',   specialty: 'Dentistry',    specialtyAr: 'أسنان',   gender: 'MALE',   email: 'khalid@deqah-test.com',  phone: '+966500000003', experience: null, isActive: true },
    // 7 more to cover plan §1.2 (10+, mixed active/inactive, experience coverage, branch 2).
    { id: '00000000-0000-4000-8000-000000000004', name: 'سارة الحربي',    nameEn: 'Sarah Alharbi',    nameAr: 'سارة الحربي',    title: 'أخصائية باطنة', specialty: 'Internal Med', specialtyAr: 'باطنة',   gender: 'FEMALE', email: 'sarah@deqah-test.com',   phone: '+966500000004', experience: 5,  isActive: true,  extraBranchId: BRANCH_ID_2 },
    { id: '00000000-0000-4000-8000-000000000005', name: 'عمر العتيبي',    nameEn: 'Omar Alotaibi',    nameAr: 'عمر العتيبي',    title: 'أخصائي جلدية',   specialty: 'Dermatology',  specialtyAr: 'جلدية',   gender: 'MALE',   email: 'omar@deqah-test.com',    phone: '+966500000005', experience: 3,  isActive: true  },
    { id: '00000000-0000-4000-8000-000000000006', name: 'هند الدوسري',    nameEn: 'Hind Aldosari',    nameAr: 'هند الدوسري',    title: 'أخصائية أسنان', specialty: 'Dentistry',    specialtyAr: 'أسنان',   gender: 'FEMALE', email: 'hind@deqah-test.com',    phone: '+966500000006', experience: 15, isActive: true,  extraBranchId: BRANCH_ID_2 },
    { id: '00000000-0000-4000-8000-000000000007', name: 'يوسف المطيري',   nameEn: 'Yousef Almutairi', nameAr: 'يوسف المطيري',   title: 'طبيب عام',       specialty: 'General',      specialtyAr: 'طب عام',  gender: 'MALE',   email: 'yousef@deqah-test.com',  phone: '+966500000007', experience: 2,  isActive: true  },
    { id: '00000000-0000-4000-8000-000000000008', name: 'ريم الشهري',     nameEn: 'Reem Alshehri',    nameAr: 'ريم الشهري',     title: 'أخصائية جلدية', specialty: 'Dermatology',  specialtyAr: 'جلدية',   gender: 'FEMALE', email: 'reem.dr@deqah-test.com', phone: '+966500000008', experience: 7,  isActive: false },
    { id: '00000000-0000-4000-8000-000000000009', name: 'طلال الزهراني',  nameEn: 'Talal Alzahrani',  nameAr: 'طلال الزهراني',  title: 'أخصائي أسنان',   specialty: 'Dentistry',    specialtyAr: 'أسنان',   gender: 'MALE',   email: 'talal@deqah-test.com',   phone: '+966500000009', experience: 20, isActive: false },
    { id: '00000000-0000-4000-8000-00000000000a', name: 'ليان القحطاني',  nameEn: 'Layan Alqahtani',  nameAr: 'ليان القحطاني',  title: 'طبيبة عامة',    specialty: 'General',      specialtyAr: 'طب عام',  gender: 'FEMALE', email: 'layan@deqah-test.com',   phone: '+966500000010', experience: 1,  isActive: true  },
  ];

  for (const e of employees) {
    await prisma.employee.upsert({
      where: { id: e.id },
      create: {
        id: e.id,
        organizationId: DEFAULT_ORG_ID,
        name: e.name,
        nameEn: e.nameEn,
        nameAr: e.nameAr,
        title: e.title,
        specialty: e.specialty,
        specialtyAr: e.specialtyAr,
        gender: e.gender,
        email: e.email,
        phone: e.phone,
        experience: e.experience,
        employmentType: 'FULL_TIME',
        onboardingStatus: 'COMPLETED',
        isActive: e.isActive,
        updatedAt: new Date(),
      },
      update: { name: e.name, nameEn: e.nameEn, nameAr: e.nameAr, title: e.title, experience: e.experience, isActive: e.isActive },
    });
    await prisma.employeeBranch.upsert({
      where: { employeeId_branchId: { employeeId: e.id, branchId: BRANCH_ID } },
      create: { employeeId: e.id, branchId: BRANCH_ID, organizationId: DEFAULT_ORG_ID },
      update: {},
    });
    if (e.extraBranchId) {
      await prisma.employeeBranch.upsert({
        where: { employeeId_branchId: { employeeId: e.id, branchId: e.extraBranchId } },
        create: { employeeId: e.id, branchId: e.extraBranchId, organizationId: DEFAULT_ORG_ID },
        update: {},
      });
    }

    // Default availability: Sun..Thu 09:00–17:00.
    // Dashboard's create form uses the same defaults; seeded employees without
    // these rows are invisible to the booking slots endpoint → create-booking
    // flow dead-ends on the date picker. EmployeeAvailability has no compound
    // unique on (employeeId, dayOfWeek), so gate on count to stay idempotent.
    const availabilityCount = await prisma.employeeAvailability.count({ where: { employeeId: e.id } });
    if (availabilityCount === 0) {
      await prisma.employeeAvailability.createMany({
        data: [0, 1, 2, 3, 4].map((dayOfWeek) => ({
          employeeId: e.id,
          organizationId: DEFAULT_ORG_ID,
          dayOfWeek,
          startTime: '09:00',
          endTime: '17:00',
          isActive: true,
        })),
      });
    }
  }

  // Categories first — the dashboard's create-service form enforces category
  // as required, so seeded services without one create a UI/contract mismatch.
  const categories = [
    { id: '00000000-0000-4000-8000-00000000c001', nameAr: 'باطنة', nameEn: 'General Medicine', sortOrder: 1 },
    { id: '00000000-0000-4000-8000-00000000c002', nameAr: 'أسنان',  nameEn: 'Dentistry',        sortOrder: 2 },
    { id: '00000000-0000-4000-8000-00000000c003', nameAr: 'جلدية',  nameEn: 'Dermatology',      sortOrder: 3 },
  ];
  for (const c of categories) {
    await prisma.serviceCategory.upsert({
      where: { id: c.id },
      create: { ...c, organizationId: DEFAULT_ORG_ID, isActive: true, updatedAt: new Date() },
      update: {},
    });
  }

  // NOTE ON PRICE UNITS:
  //   Schema is `price Decimal @db.Decimal(12, 2)` with `currency: SAR`, but
  //   the dashboard consistently multiplies by 100 on save and divides by 100
  //   on display (service-form-page, service-columns, duration-options-editor).
  //   i.e. the runtime convention is "halalas stored as Decimal". This seed
  //   matches that convention so demo prices render as 120/250/200 SAR, not
  //   1.20/2.50/2.00. Unifying on SAR is tracked as tech-debt separately.
  const services = [
    { id: '00000000-0000-4000-8000-000000000011', nameAr: 'كشف عام', nameEn: 'General consultation', durationMins: 30, price: '12000.00', categoryId: '00000000-0000-4000-8000-00000000c001' },
    { id: '00000000-0000-4000-8000-000000000012', nameAr: 'تنظيف أسنان', nameEn: 'Dental cleaning', durationMins: 45, price: '25000.00', categoryId: '00000000-0000-4000-8000-00000000c002' },
    { id: '00000000-0000-4000-8000-000000000013', nameAr: 'استشارة جلدية', nameEn: 'Dermatology consult', durationMins: 30, price: '20000.00', categoryId: '00000000-0000-4000-8000-00000000c003' },
  ];

  for (const s of services) {
    await prisma.service.upsert({
      where: { id: s.id },
      create: { ...s, organizationId: DEFAULT_ORG_ID, price: s.price as any, currency: 'SAR', isActive: true, updatedAt: new Date() },
      update: { categoryId: s.categoryId, price: s.price as any },
    });

    // Every service is bookable IN_PERSON by default — the wizard's step-4
    // reads these rows to know which booking types to offer.
    await prisma.serviceBookingConfig.upsert({
      where: { serviceId_bookingType: { serviceId: s.id, bookingType: 'in_person' } },
      create: {
        id: `${s.id}-in-person`,
        organizationId: DEFAULT_ORG_ID,
        serviceId: s.id,
        bookingType: 'in_person',
        price: s.price as any,
        durationMins: s.durationMins,
        isActive: true,
        updatedAt: new Date(),
      },
      update: { price: s.price as any },
    });
  }

  // link services to employees (EmployeeService)
  const empService = [
    { employeeId: '00000000-0000-4000-8000-000000000001', serviceId: '00000000-0000-4000-8000-000000000011' },
    { employeeId: '00000000-0000-4000-8000-000000000002', serviceId: '00000000-0000-4000-8000-000000000013' },
    { employeeId: '00000000-0000-4000-8000-000000000003', serviceId: '00000000-0000-4000-8000-000000000012' },
    { employeeId: '00000000-0000-4000-8000-000000000001', serviceId: '00000000-0000-4000-8000-000000000013' },
  ];
  for (const es of empService) {
    await prisma.employeeService.upsert({
      where: { employeeId_serviceId: es },
      create: { ...es, organizationId: DEFAULT_ORG_ID },
      update: {},
    });
  }

  // 25 clients total so the dashboard paginates (perPage=20).
  // Mix of FULL / WALK_IN accounts and a couple of email-verified rows so the
  // dashboard's Walk-In badge + ✓ verified indicator have real data to render.
  const baseClients = [
    { id: '00000000-0000-4000-8000-000000000021', name: 'محمد الحربي',      firstName: 'محمد',    lastName: 'الحربي',     phone: '+966511111111', email: 'mohammed@example.com', gender: 'MALE' as const,   accountType: 'FULL'    as const, emailVerified: true,  isActive: true  },
    { id: '00000000-0000-4000-8000-000000000022', name: 'نورة العتيبي',    firstName: 'نورة',   lastName: 'العتيبي',    phone: '+966522222222', email: 'noura@example.com',    gender: 'FEMALE' as const, accountType: 'FULL'    as const, emailVerified: true,  isActive: true  },
    { id: '00000000-0000-4000-8000-000000000023', name: 'سارة الدوسري',    firstName: 'سارة',   lastName: 'الدوسري',    phone: '+966533333333', email: 'sara@example.com',     gender: 'FEMALE' as const, accountType: 'FULL'    as const, emailVerified: false, isActive: true  },
    { id: '00000000-0000-4000-8000-000000000024', name: 'خالد الزهراني',   firstName: 'خالد',   lastName: 'الزهراني',   phone: '+966544444444', email: 'khalid@example.com',   gender: 'MALE' as const,   accountType: 'FULL'    as const, emailVerified: false, isActive: true  },
    { id: '00000000-0000-4000-8000-000000000025', name: 'ريم السبيعي',     firstName: 'ريم',    lastName: 'السبيعي',    phone: '+966555555555', email: 'reem@example.com',     gender: 'FEMALE' as const, accountType: 'WALK_IN' as const, emailVerified: false, isActive: true  },
    { id: '00000000-0000-4000-8000-000000000026', name: 'عبدالله القحطاني', firstName: 'عبدالله', lastName: 'القحطاني',   phone: '+966566666666', email: null,                    gender: 'MALE' as const,   accountType: 'WALK_IN' as const, emailVerified: false, isActive: true  },
    { id: '00000000-0000-4000-8000-000000000027', name: 'منى الشهري',      firstName: 'منى',    lastName: 'الشهري',     phone: '+966577777777', email: null,                    gender: 'FEMALE' as const, accountType: 'WALK_IN' as const, emailVerified: false, isActive: false },
    { id: '00000000-0000-4000-8000-000000000028', name: 'يوسف العمري',    firstName: 'يوسف',   lastName: 'العمري',     phone: '+966588888888', email: 'yousef@example.com',   gender: 'MALE' as const,   accountType: 'FULL'    as const, emailVerified: false, isActive: false },
  ];

  // 17 more clients so total = 25 (triggers pagination beyond page 1).
  const bulkClients = Array.from({ length: 17 }, (_, i) => {
    const n = i + 29; // continue numeric suffix after 28
    const paddedN = String(n).padStart(2, '0');
    const id = `00000000-0000-4000-8000-0000000000${paddedN}`;
    return {
      id,
      name: `عميل رقم ${n}`,
      firstName: `عميل`,
      lastName: `رقم ${n}`,
      phone: `+9666${String(10000000 + n).slice(-8)}`,
      email: `client${n}@example.com`,
      gender: (n % 2 === 0 ? 'FEMALE' : 'MALE') as 'MALE' | 'FEMALE',
      accountType: 'FULL' as const,
      emailVerified: false,
      isActive: true,
    };
  });

  const clients = [...baseClients, ...bulkClients];

  for (const c of clients) {
    await prisma.client.upsert({
      where: { id: c.id },
      create: {
        id: c.id,
        organizationId: DEFAULT_ORG_ID,
        name: c.name,
        firstName: c.firstName,
        lastName: c.lastName,
        phone: c.phone,
        email: c.email,
        emailVerified: c.emailVerified ? new Date() : null,
        gender: c.gender,
        source: 'ONLINE' as any,
        accountType: c.accountType as any,
        isActive: c.isActive,
        updatedAt: new Date(),
      },
      update: {
        emailVerified: c.emailVerified ? new Date() : null,
        accountType: c.accountType as any,
        isActive: c.isActive,
      },
    });
  }

  // Bookings — various statuses & dates around 2026-04-17
  const today = new Date('2026-04-17T00:00:00Z');
  const mk = (offsetDays: number, hour: number) => {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() + offsetDays);
    d.setUTCHours(hour, 0, 0, 0);
    return d;
  };

  const bookings = [
    { id: 'bkg-1',  clientId: '00000000-0000-4000-8000-000000000021', employeeId: '00000000-0000-4000-8000-000000000001', serviceId: '00000000-0000-4000-8000-000000000011', status: 'PENDING',   type: 'INDIVIDUAL', at: mk(0, 9),  durationMins: 30, price: '120.00' },
    { id: 'bkg-2',  clientId: '00000000-0000-4000-8000-000000000022', employeeId: '00000000-0000-4000-8000-000000000002', serviceId: '00000000-0000-4000-8000-000000000013', status: 'CONFIRMED', type: 'INDIVIDUAL', at: mk(0, 10), durationMins: 30, price: '200.00' },
    { id: 'bkg-3',  clientId: '00000000-0000-4000-8000-000000000023', employeeId: '00000000-0000-4000-8000-000000000003', serviceId: '00000000-0000-4000-8000-000000000012', status: 'COMPLETED', type: 'INDIVIDUAL', at: mk(-1, 11),durationMins: 45, price: '250.00' },
    { id: 'bkg-4',  clientId: '00000000-0000-4000-8000-000000000021', employeeId: '00000000-0000-4000-8000-000000000002', serviceId: '00000000-0000-4000-8000-000000000013', status: 'CANCELLED', type: 'ONLINE',     at: mk(1, 14), durationMins: 30, price: '200.00' },
    { id: 'bkg-5',  clientId: '00000000-0000-4000-8000-000000000022', employeeId: '00000000-0000-4000-8000-000000000001', serviceId: '00000000-0000-4000-8000-000000000011', status: 'NO_SHOW',   type: 'INDIVIDUAL', at: mk(-2, 15),durationMins: 30, price: '120.00' },
    { id: 'bkg-6',  clientId: '00000000-0000-4000-8000-000000000023', employeeId: '00000000-0000-4000-8000-000000000001', serviceId: '00000000-0000-4000-8000-000000000011', status: 'AWAITING_PAYMENT', type: 'INDIVIDUAL', at: mk(0, 12), durationMins: 30, price: '120.00' },
    { id: 'bkg-7',  clientId: '00000000-0000-4000-8000-000000000021', employeeId: '00000000-0000-4000-8000-000000000003', serviceId: '00000000-0000-4000-8000-000000000012', status: 'CONFIRMED', type: 'WALK_IN',    at: mk(0, 13), durationMins: 45, price: '250.00' },
    { id: 'bkg-8',  clientId: '00000000-0000-4000-8000-000000000022', employeeId: '00000000-0000-4000-8000-000000000002', serviceId: '00000000-0000-4000-8000-000000000013', status: 'PENDING',   type: 'ONLINE',     at: mk(2, 10), durationMins: 30, price: '200.00' },
    { id: 'bkg-9',  clientId: '00000000-0000-4000-8000-000000000023', employeeId: '00000000-0000-4000-8000-000000000001', serviceId: '00000000-0000-4000-8000-000000000011', status: 'CONFIRMED', type: 'INDIVIDUAL', at: mk(3, 9),  durationMins: 30, price: '120.00' },
    { id: 'bkg-10', clientId: '00000000-0000-4000-8000-000000000021', employeeId: '00000000-0000-4000-8000-000000000003', serviceId: '00000000-0000-4000-8000-000000000012', status: 'PENDING',   type: 'INDIVIDUAL', at: mk(4, 11), durationMins: 45, price: '250.00' },
    { id: 'bkg-11', clientId: '00000000-0000-4000-8000-000000000022', employeeId: '00000000-0000-4000-8000-000000000002', serviceId: '00000000-0000-4000-8000-000000000013', status: 'EXPIRED', type:'INDIVIDUAL', at: mk(-3, 14), durationMins: 30, price: '200.00' },
    { id: 'bkg-12', clientId: '00000000-0000-4000-8000-000000000023', employeeId: '00000000-0000-4000-8000-000000000001', serviceId: '00000000-0000-4000-8000-000000000011', status: 'CANCEL_REQUESTED', type: 'INDIVIDUAL', at: mk(1, 10), durationMins: 30, price: '120.00' },
    // Extra bookings so more clients (خالد, ريم, عبدالله) show real lastBooking/nextBooking.
    { id: 'bkg-13', clientId: '00000000-0000-4000-8000-000000000024', employeeId: '00000000-0000-4000-8000-000000000001', serviceId: '00000000-0000-4000-8000-000000000011', status: 'COMPLETED', type: 'INDIVIDUAL', at: mk(-5, 10), durationMins: 30, price: '120.00' },
    { id: 'bkg-14', clientId: '00000000-0000-4000-8000-000000000024', employeeId: '00000000-0000-4000-8000-000000000002', serviceId: '00000000-0000-4000-8000-000000000013', status: 'CONFIRMED', type: 'INDIVIDUAL', at: mk(5, 11),  durationMins: 30, price: '200.00' },
    { id: 'bkg-15', clientId: '00000000-0000-4000-8000-000000000025', employeeId: '00000000-0000-4000-8000-000000000003', serviceId: '00000000-0000-4000-8000-000000000012', status: 'COMPLETED', type: 'WALK_IN',    at: mk(-7, 12), durationMins: 45, price: '250.00' },
    { id: 'bkg-16', clientId: '00000000-0000-4000-8000-000000000025', employeeId: '00000000-0000-4000-8000-000000000003', serviceId: '00000000-0000-4000-8000-000000000012', status: 'PENDING',   type: 'WALK_IN',    at: mk(6, 9),   durationMins: 45, price: '250.00' },
    { id: 'bkg-17', clientId: '00000000-0000-4000-8000-000000000026', employeeId: '00000000-0000-4000-8000-000000000001', serviceId: '00000000-0000-4000-8000-000000000011', status: 'COMPLETED', type: 'WALK_IN',    at: mk(-3, 15), durationMins: 30, price: '120.00' },
  ];

  for (const b of bookings) {
    const endsAt = new Date(b.at.getTime() + b.durationMins * 60_000);
    await prisma.booking.upsert({
      where: { id: b.id },
      create: {
        id: b.id,
        organizationId: DEFAULT_ORG_ID,
        branchId: BRANCH_ID,
        clientId: b.clientId,
        employeeId: b.employeeId,
        serviceId: b.serviceId,
        bookingType: b.type as any,
        status: b.status as any,
        scheduledAt: b.at,
        endsAt,
        durationMins: b.durationMins,
        price: b.price as any,
        currency: 'SAR',
        payAtClinic: false,
        updatedAt: new Date(),
      },
      update: {},
    });
  }

  // Ratings — tie them to COMPLETED bookings so one employee accumulates an
  // average that the UI can surface (plan §1.2: "an employee with ratings").
  const completed = bookings.filter((b) => b.status === 'COMPLETED');
  const ratings = completed.slice(0, 4).map((b, i) => ({
    id: `rating-${i + 1}`,
    bookingId: b.id,
    clientId: b.clientId,
    employeeId: b.employeeId,
    score: [5, 4, 5, 4][i] ?? 5,
    comment: ['خدمة ممتازة', 'جيد جداً', 'راضٍ تماماً', 'شكراً على الاهتمام'][i] ?? null,
    isPublic: true,
  }));
  for (const r of ratings) {
    await prisma.rating.upsert({
      where: { id: r.id },
      create: { ...r, organizationId: DEFAULT_ORG_ID },
      update: {},
    });
  }

  await prisma.$disconnect();

  console.log('─────────────────────────────────────────────');
  console.log(`✔  ${employees.length} employees, ${services.length} services, ${clients.length} clients, ${bookings.length} bookings, ${ratings.length} ratings seeded`);
  console.log('─────────────────────────────────────────────');
}

main().catch((e) => { console.error(e); process.exit(1); });
