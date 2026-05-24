/**
 * Idempotent seed: inserts (or updates) demo therapists for the public website,
 * then wires them to services + branches + availability so the booking flow is
 * actually completable end-to-end. Re-runs safely.
 *
 * Run:  npm run seed:therapists --workspace=backend
 */

import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

type ServiceSlug = 'individual' | 'online' | 'group';

interface DemoTherapist {
  slug: string;
  nameAr: string;
  nameEn: string;
  name: string;
  title: string;
  specialty: string;
  specialtyAr: string;
  gender: 'MALE' | 'FEMALE';
  experience: number;
  publicBioAr: string;
  publicBioEn: string;
  publicImageUrl: string | null;
  /** Service slugs (resolved by Arabic name match) this therapist delivers. */
  services: ServiceSlug[];
  /** Days of week available, 0=Sunday … 6=Saturday. */
  days: number[];
  startTime: string;
  endTime: string;
}

const DEMOS: DemoTherapist[] = [
  {
    slug: 'dr-sara-alqahtani',
    nameAr: 'د. سارة القحطاني',
    nameEn: 'Dr. Sara Alqahtani',
    name: 'Sara Alqahtani',
    title: 'استشارية علاج زواجي',
    specialty: 'Marriage & Family Therapy',
    specialtyAr: 'العلاج الزواجي والأسري',
    gender: 'FEMALE',
    experience: 12,
    publicBioAr:
      'تركّز سارة على عمل الأزواج في مراحل التحوّل: ما قبل الزواج، الحمل الأول، والعودة بعد فترات بعيدة. تعتمد منهج Gottman ومدرسة EFT في الجلسات.',
    publicBioEn:
      'Sara focuses on couples in transition: pre-marriage, first pregnancy, and reconnection after distance. She practices Gottman and EFT-based methods.',
    publicImageUrl: null,
    services: ['individual', 'online'],
    days: [0, 1, 2, 3, 4], // Sun-Thu
    startTime: '09:00',
    endTime: '17:00',
  },
  {
    slug: 'dr-khalid-alotaibi',
    nameAr: 'د. خالد العتيبي',
    nameEn: 'Dr. Khalid Alotaibi',
    name: 'Khalid Alotaibi',
    title: 'أخصائي نفسي إكلينيكي',
    specialty: 'Clinical Psychology',
    specialtyAr: 'علم النفس الإكلينيكي',
    gender: 'MALE',
    experience: 9,
    publicBioAr:
      'خالد متخصص في القلق العام، نوبات الهلع، واضطرابات النوم لدى البالغين. يستخدم العلاج المعرفي السلوكي (CBT) ومهارات تنظيم الانفعالات.',
    publicBioEn:
      'Khalid specializes in generalized anxiety, panic attacks, and adult sleep disorders. He works through cognitive behavioral therapy (CBT) and emotion regulation skills.',
    publicImageUrl: null,
    services: ['individual', 'online'],
    days: [1, 2, 3, 4, 6], // Mon-Thu + Sat
    startTime: '10:00',
    endTime: '18:00',
  },
  {
    slug: 'dr-noura-alshehri',
    nameAr: 'د. نورة الشهري',
    nameEn: 'Dr. Noura Alshehri',
    name: 'Noura Alshehri',
    title: 'أخصائية إرشاد تربوي',
    specialty: 'Child & Adolescent Counseling',
    specialtyAr: 'إرشاد الأطفال والمراهقين',
    gender: 'FEMALE',
    experience: 7,
    publicBioAr:
      'تعمل نورة مع الأطفال والمراهقين حول الانسحاب الدراسي، مشاكل السلوك، والتأقلم بعد الطلاق. تشرك الأهل بشكل منظّم في خطة العلاج.',
    publicBioEn:
      'Noura works with children and teens on school refusal, behavioral struggles, and adjustment after divorce. She integrates parents structurally into the treatment plan.',
    publicImageUrl: null,
    services: ['individual', 'online', 'group'],
    days: [0, 1, 2, 3, 4],
    startTime: '08:00',
    endTime: '16:00',
  },
  {
    slug: 'dr-mohammed-alharbi',
    nameAr: 'د. محمد الحربي',
    nameEn: 'Dr. Mohammed Alharbi',
    name: 'Mohammed Alharbi',
    title: 'مرشد أسري معتمد',
    specialty: 'Family Mediation',
    specialtyAr: 'الوساطة الأسرية',
    gender: 'MALE',
    experience: 15,
    publicBioAr:
      'محمد متخصص في تيسير الحوار بين الأزواج، تربية المراهقين، وإدارة الخلافات بين الأشقاء البالغين. خبرته الطويلة تساعد على فهم السياق الثقافي والديني.',
    publicBioEn:
      'Mohammed specializes in facilitating dialogue between spouses, parenting teenagers, and managing disputes between adult siblings. His long experience helps navigate cultural and religious context.',
    publicImageUrl: null,
    services: ['individual', 'online'],
    days: [0, 2, 3, 4, 6],
    startTime: '14:00',
    endTime: '21:00',
  },
  {
    slug: 'dr-layla-alzahrani',
    nameAr: 'د. ليلى الزهراني',
    nameEn: 'Dr. Layla Alzahrani',
    name: 'Layla Alzahrani',
    title: 'أخصائية صحة نفسية للنساء',
    specialty: "Women's Mental Health",
    specialtyAr: 'الصحة النفسية للنساء',
    gender: 'FEMALE',
    experience: 10,
    publicBioAr:
      'ليلى تركّز على اكتئاب ما بعد الولادة، ضغوط الأمومة، وفقدان الهوية بعد الزواج. تجمع بين النهج التحليلي والعلاج المتمحور حول الذات.',
    publicBioEn:
      'Layla focuses on postpartum depression, motherhood stress, and identity loss after marriage. She blends analytic and person-centered therapy approaches.',
    publicImageUrl: null,
    services: ['individual', 'online', 'group'],
    days: [0, 1, 2, 3, 4, 6],
    startTime: '09:00',
    endTime: '17:00',
  },
];

const SERVICE_NAME_BY_SLUG: Record<ServiceSlug, string> = {
  individual: 'جلسة استشارة فردية',
  online: 'جلسة استشارة أونلاين',
  group: 'جلسة دعم جماعي',
};

const MAIN_BRANCH_NAME = 'مركز سواء للاستشارات الأسرية';

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });
  await prisma.$connect();

  // Resolve referenced services once.
  const serviceRows = await prisma.service.findMany({
    where: {
      isActive: true,
      archivedAt: null,
      nameAr: { in: Object.values(SERVICE_NAME_BY_SLUG) },
    },
    select: { id: true, nameAr: true },
  });
  const serviceIdByName = new Map(serviceRows.map((s) => [s.nameAr, s.id]));
  for (const slug of Object.keys(SERVICE_NAME_BY_SLUG) as ServiceSlug[]) {
    if (!serviceIdByName.has(SERVICE_NAME_BY_SLUG[slug])) {
      throw new Error(`Missing service "${SERVICE_NAME_BY_SLUG[slug]}" — run the base seed first.`);
    }
  }

  // Resolve the main branch.
  const mainBranch = await prisma.branch.findFirst({
    where: { isActive: true, nameAr: MAIN_BRANCH_NAME },
    select: { id: true, nameAr: true },
  });
  if (!mainBranch) {
    throw new Error(`Missing main branch "${MAIN_BRANCH_NAME}" — run the base seed first.`);
  }

  // Ensure the branch has open business hours every day; without them the
  // availability check intersects with an empty window and returns no slots.
  await prisma.businessHour.deleteMany({ where: { branchId: mainBranch.id } });
  await prisma.businessHour.createMany({
    data: [0, 1, 2, 3, 4, 5, 6].map((d) => ({
      branchId: mainBranch.id,
      dayOfWeek: d,
      startTime: '08:00',
      endTime: '22:00',
      isOpen: true,
    })),
  });

  for (const t of DEMOS) {
    const existing = await prisma.employee.findFirst({ where: { slug: t.slug } });
    const data = {
      name: t.name,
      nameAr: t.nameAr,
      nameEn: t.nameEn,
      title: t.title,
      specialty: t.specialty,
      specialtyAr: t.specialtyAr,
      gender: t.gender,
      experience: t.experience,
      publicBioAr: t.publicBioAr,
      publicBioEn: t.publicBioEn,
      publicImageUrl: t.publicImageUrl,
      slug: t.slug,
      isPublic: true,
      isActive: true,
      employmentType: 'FULL_TIME' as const,
    };

    const emp = existing
      ? await prisma.employee.update({ where: { id: existing.id }, data })
      : await prisma.employee.create({ data });

    // Link services (idempotent — wipe & re-insert this employee's links).
    await prisma.employeeService.deleteMany({ where: { employeeId: emp.id } });
    await prisma.employeeService.createMany({
      data: t.services.map((s) => ({
        employeeId: emp.id,
        serviceId: serviceIdByName.get(SERVICE_NAME_BY_SLUG[s])!,
      })),
    });

    // Link to the main branch.
    await prisma.employeeBranch.deleteMany({ where: { employeeId: emp.id } });
    await prisma.employeeBranch.create({
      data: { employeeId: emp.id, branchId: mainBranch.id },
    });

    // Availability rules — overwrite per employee for determinism.
    await prisma.employeeAvailability.deleteMany({ where: { employeeId: emp.id } });
    await prisma.employeeAvailability.createMany({
      data: t.days.map((d) => ({
        employeeId: emp.id,
        dayOfWeek: d,
        startTime: t.startTime,
        endTime: t.endTime,
        isActive: true,
      })),
    });

    console.log(
      `${existing ? 'updated' : 'created'}: ${t.slug} → ${t.services.length} svc, ${t.days.length} days`,
    );
  }

  const count = await prisma.employee.count({ where: { isPublic: true, isActive: true } });
  const linkCount = await prisma.employeeService.count({
    where: { employee: { isPublic: true, isActive: true } },
  });
  console.log(`\npublic+active therapists: ${count}, total service links: ${linkCount}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
