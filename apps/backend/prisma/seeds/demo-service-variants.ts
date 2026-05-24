import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const SERVICE_ID = 'cd8f5496-544f-48b2-b18b-022428e34b4c'; // جلسة استشارة فردية

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });
  await prisma.$connect();

  // 1) Add ONLINE config to "جلسة استشارة فردية" (already has IN_PERSON 60min/200)
  await prisma.serviceBookingConfig.upsert({
    where: { serviceId_deliveryType: { serviceId: SERVICE_ID, deliveryType: 'ONLINE' } },
    create: {
      serviceId: SERVICE_ID,
      deliveryType: 'ONLINE',
      price: 15000, // 150 SAR
      durationMins: 45,
      isActive: true,
    },
    update: { price: 15000, durationMins: 45, isActive: true },
  });

  // 2) Add 3 duration options: 30/60/90 for IN_PERSON, 30/45 for ONLINE
  type Opt = {
    deliveryType: 'IN_PERSON' | 'ONLINE';
    labelAr: string;
    label: string;
    durationMins: number;
    price: number; // halalas
    isDefault: boolean;
    sortOrder: number;
  };
  const opts: Opt[] = [
    { deliveryType: 'IN_PERSON', labelAr: 'قصيرة', label: 'Short', durationMins: 30, price: 12000, isDefault: false, sortOrder: 1 },
    { deliveryType: 'IN_PERSON', labelAr: 'عادية', label: 'Standard', durationMins: 60, price: 20000, isDefault: true, sortOrder: 2 },
    { deliveryType: 'IN_PERSON', labelAr: 'موسعة', label: 'Extended', durationMins: 90, price: 28000, isDefault: false, sortOrder: 3 },
    { deliveryType: 'ONLINE', labelAr: 'سريعة', label: 'Quick', durationMins: 30, price: 10000, isDefault: false, sortOrder: 1 },
    { deliveryType: 'ONLINE', labelAr: 'عادية', label: 'Standard', durationMins: 45, price: 15000, isDefault: true, sortOrder: 2 },
  ];

  // Wipe + recreate (idempotent)
  await prisma.serviceDurationOption.deleteMany({ where: { serviceId: SERVICE_ID } });
  const created = [];
  for (const o of opts) {
    const row = await prisma.serviceDurationOption.create({
      data: { serviceId: SERVICE_ID, ...o },
    });
    created.push(row);
  }
  console.log(`Created ${created.length} duration options for service.`);

  // 3) Per-employee override: pick first employee who offers this service
  const empService = await prisma.employeeService.findFirst({
    where: { serviceId: SERVICE_ID },
  });
  if (!empService) {
    console.log('No employee linked to this service — skipping per-employee override.');
  } else {
    console.log(`Adding override for employee: ${empService.employeeId.slice(0, 8)}`);

    // Override the "extended" 90-min option: charge 320 instead of 280, and bump to 100 min
    const extended = created.find((o) => o.deliveryType === 'IN_PERSON' && o.durationMins === 90);
    if (extended) {
      await prisma.employeeServiceOption.deleteMany({
        where: { employeeServiceId: empService.id, durationOptionId: extended.id },
      });
      await prisma.employeeServiceOption.create({
        data: {
          employeeServiceId: empService.id,
          durationOptionId: extended.id,
          priceOverride: 32000,
          durationOverride: 100,
          deliveryType: 'IN_PERSON',
          isActive: true,
        },
      });
      console.log('  override: IN_PERSON 90min → 100min / 320 SAR');
    }

    // Override the online standard: 200 SAR for 45 min (this therapist is pricier)
    const onlineStd = created.find((o) => o.deliveryType === 'ONLINE' && o.durationMins === 45);
    if (onlineStd) {
      await prisma.employeeServiceOption.deleteMany({
        where: { employeeServiceId: empService.id, durationOptionId: onlineStd.id },
      });
      await prisma.employeeServiceOption.create({
        data: {
          employeeServiceId: empService.id,
          durationOptionId: onlineStd.id,
          priceOverride: 20000,
          durationOverride: null,
          deliveryType: 'ONLINE',
          isActive: true,
        },
      });
      console.log('  override: ONLINE 45min → 200 SAR');
    }
  }

  console.log('\nDone.');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
