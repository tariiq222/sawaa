import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });
  const res = await prisma.employee.deleteMany({
    where: {
      nameEn: { in: ['General Checkup', 'General Consultation'] },
    },
  });
  console.log(`Deleted ${res.count} corrupted employee rows`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
