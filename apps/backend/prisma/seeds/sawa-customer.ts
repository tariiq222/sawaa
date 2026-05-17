/**
 * Idempotent seed: resets the Department table to exactly the 3 Sawa departments.
 *
 * Run:  npm run seed:sawa --workspace=backend
 * Safe to re-run.
 */

import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });
  await prisma.$connect();

  await prisma.department.deleteMany({});
  await prisma.department.createMany({
    data: [
      {
        nameAr: 'عيادات سواء',
        nameEn: 'Sawa Clinics',
        descriptionAr: 'عيادات الإرشاد والدعم النفسي والأسري',
        descriptionEn: 'Counseling and psychological & family support clinics',
        icon: 'Stethoscope',
        sortOrder: 0,
      },
      {
        nameAr: 'جلسات جماعية',
        nameEn: 'Group Sessions',
        descriptionAr:
          'جلسات علاجية جماعية للمتعافين من الإدمان والمرضى النفسيين عبر أنشطة داعمة',
        descriptionEn:
          'Group therapy sessions for recovering addicts and psychiatric patients through supportive activities',
        icon: 'Users',
        sortOrder: 1,
      },
      {
        nameAr: 'باقات سواء',
        nameEn: 'Sawa Packages',
        descriptionAr: 'باقات الجلسات والاشتراكات بأسعار خاصة',
        descriptionEn: 'Session bundles and subscriptions at special prices',
        icon: 'Package',
        sortOrder: 2,
      },
    ],
  });
  console.log('✓ Reset departments: 3 created');

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
