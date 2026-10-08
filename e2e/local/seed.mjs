import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { assertIsolatedDatabase } from './safety.mjs';

const require = createRequire(new URL('../../apps/backend/package.json', import.meta.url));
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const bcrypt = require('bcryptjs');

export async function seed(env, output) {
  assertIsolatedDatabase(env.DATABASE_URL);
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL }) });
  try {
    // A new empty database is the contract; never upsert or clean shared data.
    if (await prisma.client.count() || await prisma.booking.count()) throw new Error('Fixture database is not empty');
    await prisma.organizationSettings.create({ data: {
      companyNameAr: 'مركز اختبار سواء', vatRate: 0,
      paymentAtClinicEnabled: true, paymentMoyasarEnabled: false,
    } });
    await prisma.bookingSettings.create({ data: { payAtClinicEnabled: true } });
    const password = `Fixture9!${randomBytes(20).toString('hex')}`;
    const passwordHash = await bcrypt.hash(password, 12);
    const staff = await prisma.user.create({ data: {
      name: 'مشرف الاختبار', email: 'staff@example.test', passwordHash,
      isSuperAdmin: true, role: 'SUPER_ADMIN', emailVerifiedAt: new Date(),
    } });
    const clients = {};
    for (const [kind, phone] of [['web', '+966550000101'], ['mobile', '+966550000102'], ['payment', '+966550000103'], ['apple', '+966550000104']]) {
      const user = await prisma.user.create({ data: {
        name: `مستفيد اختبار ${kind}`, email: `${kind}@example.test`, phone,
        role: 'CLIENT', phoneVerifiedAt: new Date(), emailVerifiedAt: new Date(),
      } });
      const client = await prisma.client.create({ data: {
        userId: user.id, name: user.name, firstName: 'مستفيد', lastName: `اختبار ${kind}`,
        email: user.email, phone, accountType: 'FULL', source: 'ONLINE', passwordHash,
        emailVerified: new Date(), phoneVerified: new Date(), consentedAt: new Date(),
      } });
      clients[kind] = { id: client.id, phone, email: user.email };
    }
    const branch = await prisma.branch.create({ data: { nameAr: 'فرع الاختبار', nameEn: 'E2E Branch', isMain: true } });
    const department = await prisma.department.create({ data: { nameAr: 'قسم الاختبار', nameEn: 'E2E Department' } });
    const clinic = await prisma.serviceCategory.create({ data: {
      nameAr: 'عيادة اختبار الحجز', nameEn: 'E2E Booking Clinic',
      departmentId: department.id, kind: 'CLINIC', bookingMode: 'SERVICES',
    } });
    const service = await prisma.service.create({ data: {
      nameAr: 'جلسة اختبار أسرية', nameEn: 'E2E Family Session',
      categoryId: clinic.id, price: 30000, durationMins: 60, currency: 'SAR',
    } });
    await prisma.serviceBookingConfig.create({ data: { serviceId: service.id, deliveryType: 'IN_PERSON', price: 30000, durationMins: 60 } });
    const option = await prisma.serviceDurationOption.create({ data: {
      serviceId: service.id, deliveryType: 'IN_PERSON', label: '60 minutes', labelAr: '60 دقيقة',
      durationMins: 60, price: 30000, isDefault: true,
    } });
    const employee = await prisma.employee.create({ data: {
      name: 'ممارس الاختبار', nameAr: 'ممارس الاختبار', email: 'practitioner@example.test',
      slug: 'e2e-practitioner', isPublic: true, onboardingStatus: 'COMPLETED',
    } });
    await prisma.employeeBranch.create({ data: { employeeId: employee.id, branchId: branch.id } });
    await prisma.employeeService.create({ data: { employeeId: employee.id, serviceId: service.id } });
    for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
      await prisma.businessHour.create({ data: { branchId: branch.id, dayOfWeek, startTime: '08:00', endTime: '22:00', isOpen: true } });
      await prisma.employeeAvailability.create({ data: { employeeId: employee.id, dayOfWeek, startTime: '08:00', endTime: '22:00' } });
    }
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const appointments = Object.fromEntries([['web', 2, '08'], ['mobile', 3, '08'], ['payment', 4, '09'], ['apple', 5, '10']].map(([kind, offset, hour]) => {
      const day = new Date(`${today}T00:00:00Z`); day.setUTCDate(day.getUTCDate() + offset);
      return [kind, `${day.toISOString().slice(0, 10)}T${hour}:00:00+03:00`];
    }));
    const fixture = { appointments, clients, staff: { id: staff.id, email: staff.email },
      branchId: branch.id, clinicId: clinic.id, serviceId: service.id,
      optionId: option.id, employeeId: employee.id, priceHalalas: 30000 };
    writeFileSync(output, JSON.stringify(fixture, null, 2), { mode: 0o600 });
    return { fixture, password };
  } finally { await prisma.$disconnect(); }
}
