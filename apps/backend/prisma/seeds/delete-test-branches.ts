import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const KEEP_ID = '82192621-0213-4d36-b743-61c0eda62a25';

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });
  await prisma.$connect();

  const all = await prisma.branch.findMany({ select: { id: true, nameAr: true } });
  const toDelete = all.filter((b) => b.id !== KEEP_ID);
  console.log(`Total: ${all.length}, keep: 1, delete: ${toDelete.length}`);

  let totalRefs = 0;
  for (const b of toDelete) {
    const [bookings, empBranches, invoices, settings] = await Promise.all([
      prisma.booking.count({ where: { branchId: b.id } }),
      prisma.employeeBranch.count({ where: { branchId: b.id } }),
      prisma.invoice.count({ where: { branchId: b.id } }),
      prisma.bookingSettings.count({ where: { branchId: b.id } }),
    ]);
    const sum = bookings + empBranches + invoices + settings;
    if (sum > 0) {
      console.log(`  REFS in ${b.nameAr}: bookings=${bookings} empBranches=${empBranches} invoices=${invoices} settings=${settings}`);
      totalRefs += sum;
    }
  }

  if (totalRefs > 0) {
    console.log(`\nABORTING: ${totalRefs} references found. Will delete dependents first.`);
  }

  // Clean up dependents (employee assignments + settings + business hours/holidays will cascade)
  const ids = toDelete.map((b) => b.id);
  const empDel = await prisma.employeeBranch.deleteMany({ where: { branchId: { in: ids } } });
  const setDel = await prisma.bookingSettings.deleteMany({ where: { branchId: { in: ids } } });
  console.log(`Cleaned: empBranches=${empDel.count}, settings=${setDel.count}`);

  // Now safe to delete branches (BusinessHour + Holiday cascade)
  const result = await prisma.branch.deleteMany({ where: { id: { in: ids } } });
  console.log(`Deleted ${result.count} branches.`);

  // Make sure the kept branch is the main one
  await prisma.branch.update({
    where: { id: KEEP_ID },
    data: { isMain: true, isActive: true, nameAr: 'الفرع الرئيسي', nameEn: 'Main Branch' },
  });
  console.log('Updated kept branch as main.');

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
