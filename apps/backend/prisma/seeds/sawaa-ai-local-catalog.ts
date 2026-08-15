/**
 * Safe, additive local catalog for exercising Sawaa AI end to end.
 *
 * This seed never deletes records. Every row uses a deterministic UUID and is
 * upserted, so rerunning it updates the same local fixtures without duplicates.
 * Production execution is deliberately refused.
 *
 * Run: pnpm --filter=backend seed:sawaa-ai-local-catalog
 */

import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  DeliveryType,
  DiscountType,
  PackageConstraintDimension,
  PackageConstraintMode,
  PrismaClient,
  ProgramStatus,
} from '@prisma/client';
import Redis from 'ioredis';

const IDS = {
  branch: 'c1b2c3d4-e5f6-4a5b-8c9d-e0f1a2b3c4d5',
  department: '71aa0000-0000-4000-8000-000000000001',
  category: '71aa0000-0000-4000-8000-000000000002',
  services: {
    family: '71aa0000-0000-4000-8000-000000000101',
    couples: '71aa0000-0000-4000-8000-000000000102',
    parenting: '71aa0000-0000-4000-8000-000000000103',
  },
  durations: {
    family: '71aa0000-0000-4000-8000-000000000201',
    couples: '71aa0000-0000-4000-8000-000000000202',
    parenting: '71aa0000-0000-4000-8000-000000000203',
  },
  employees: {
    sara: '71aa0000-0000-4000-8000-000000000301',
    khalid: '71aa0000-0000-4000-8000-000000000302',
    noura: '71aa0000-0000-4000-8000-000000000303',
  },
  programs: {
    communication: '71aa0000-0000-4000-8000-000000000401',
    parenting: '71aa0000-0000-4000-8000-000000000402',
  },
  packages: {
    family: '71aa0000-0000-4000-8000-000000000501',
    couples: '71aa0000-0000-4000-8000-000000000502',
  },
  packageItems: {
    family: '71aa0000-0000-4000-8000-000000000511',
    couples: '71aa0000-0000-4000-8000-000000000512',
  },
  packageConstraints: {
    familyService: '71aa0000-0000-4000-8000-000000000521',
    familyDelivery: '71aa0000-0000-4000-8000-000000000522',
    couplesService: '71aa0000-0000-4000-8000-000000000523',
    couplesDelivery: '71aa0000-0000-4000-8000-000000000524',
  },
  packageTargets: {
    familyService: '71aa0000-0000-4000-8000-000000000531',
    couplesService: '71aa0000-0000-4000-8000-000000000532',
  },
} as const;

const services = [
  {
    id: IDS.services.family,
    durationId: IDS.durations.family,
    nameAr: 'جلسة إرشاد أسري',
    nameEn: 'Family Counseling Session',
    descriptionAr: 'جلسة تساعد الأسرة على فهم التحديات وتحسين التواصل ووضع خطوات عملية مناسبة.',
    durationMins: 60,
    price: 30000,
    iconName: 'HeartHandshake',
  },
  {
    id: IDS.services.couples,
    durationId: IDS.durations.couples,
    nameAr: 'استشارة زوجية',
    nameEn: 'Couples Consultation',
    descriptionAr: 'استشارة للزوجين لفهم الخلافات وبناء تواصل أوضح واتفاقات قابلة للتطبيق.',
    durationMins: 60,
    price: 35000,
    iconName: 'UsersRound',
  },
  {
    id: IDS.services.parenting,
    durationId: IDS.durations.parenting,
    nameAr: 'إرشاد الوالدين',
    nameEn: 'Parenting Guidance',
    descriptionAr: 'جلسة عملية للوالدين حول السلوك والتواصل والحدود المناسبة مع الأبناء.',
    durationMins: 45,
    price: 25000,
    iconName: 'Baby',
  },
] as const;

const employees = [
  {
    id: IDS.employees.sara,
    slug: 'dr-sara-alqahtani-local',
    name: 'Sara Alqahtani',
    nameAr: 'د. سارة القحطاني',
    nameEn: 'Dr. Sara Alqahtani',
    title: 'استشارية علاج زواجي وأسري',
    specialty: 'Marriage and Family Therapy',
    specialtyAr: 'العلاج الزواجي والأسري',
    gender: 'FEMALE' as const,
    experience: 12,
    bioAr: 'متخصصة في مساعدة الأزواج والأسر على فهم أنماط التواصل وبناء حلول عملية.',
    serviceIds: [IDS.services.family, IDS.services.couples],
  },
  {
    id: IDS.employees.khalid,
    slug: 'dr-khalid-alotaibi-local',
    name: 'Khalid Alotaibi',
    nameAr: 'د. خالد العتيبي',
    nameEn: 'Dr. Khalid Alotaibi',
    title: 'أخصائي نفسي إكلينيكي',
    specialty: 'Clinical Psychology',
    specialtyAr: 'علم النفس الإكلينيكي',
    gender: 'MALE' as const,
    experience: 9,
    bioAr: 'يعمل مع البالغين والأسر بأسلوب عملي يركز على المهارات وتنظيم الضغوط.',
    serviceIds: [IDS.services.family, IDS.services.parenting],
  },
  {
    id: IDS.employees.noura,
    slug: 'dr-noura-alshehri-local',
    name: 'Noura Alshehri',
    nameAr: 'د. نورة الشهري',
    nameEn: 'Dr. Noura Alshehri',
    title: 'أخصائية إرشاد تربوي وأسري',
    specialty: 'Parenting and Family Counseling',
    specialtyAr: 'الإرشاد التربوي والأسري',
    gender: 'FEMALE' as const,
    experience: 8,
    bioAr: 'متخصصة في إرشاد الوالدين والتعامل مع تحديات الأطفال والمراهقين.',
    serviceIds: [IDS.services.family, IDS.services.parenting],
  },
] as const;

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('The Sawaa AI local catalog seed must never run in production');
  }
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  await prisma.$connect();

  try {
    const branch = await prisma.branch.findUnique({ where: { id: IDS.branch } });
    if (!branch) throw new Error('Local main branch is missing; run the base seed first');

    await prisma.department.upsert({
      where: { id: IDS.department },
      update: { nameAr: 'خدمات سواء', nameEn: 'Sawaa Services', isActive: true, isVisible: true },
      create: {
        id: IDS.department,
        nameAr: 'خدمات سواء',
        nameEn: 'Sawaa Services',
        descriptionAr: 'خدمات الإرشاد الأسري والزواجي والتربوي.',
        descriptionEn: 'Family, couples, and parenting counseling services.',
        icon: 'HeartHandshake',
        sortOrder: 0,
        isActive: true,
        isVisible: true,
      },
    });
    await prisma.serviceCategory.upsert({
      where: { id: IDS.category },
      update: {
        departmentId: IDS.department,
        nameAr: 'الاستشارات الأسرية',
        nameEn: 'Family Counseling',
        isActive: true,
      },
      create: {
        id: IDS.category,
        departmentId: IDS.department,
        nameAr: 'الاستشارات الأسرية',
        nameEn: 'Family Counseling',
        sortOrder: 0,
        isActive: true,
      },
    });

    for (const service of services) {
      await prisma.service.upsert({
        where: { id: service.id },
        update: {
          categoryId: IDS.category,
          nameAr: service.nameAr,
          nameEn: service.nameEn,
          descriptionAr: service.descriptionAr,
          durationMins: service.durationMins,
          price: service.price,
          currency: 'SAR',
          iconName: service.iconName,
          isActive: true,
          isHidden: false,
          archivedAt: null,
        },
        create: {
          id: service.id,
          categoryId: IDS.category,
          nameAr: service.nameAr,
          nameEn: service.nameEn,
          descriptionAr: service.descriptionAr,
          durationMins: service.durationMins,
          price: service.price,
          currency: 'SAR',
          iconName: service.iconName,
          isActive: true,
          isHidden: false,
        },
      });
      for (const deliveryType of [DeliveryType.IN_PERSON, DeliveryType.ONLINE]) {
        await prisma.serviceBookingConfig.upsert({
          where: { serviceId_deliveryType: { serviceId: service.id, deliveryType } },
          update: {
            price: service.price,
            durationMins: service.durationMins,
            isActive: true,
            useCustomAvailability: false,
          },
          create: {
            serviceId: service.id,
            deliveryType,
            price: service.price,
            durationMins: service.durationMins,
            isActive: true,
          },
        });
      }
      await prisma.serviceDurationOption.upsert({
        where: { id: service.durationId },
        update: {
          serviceId: service.id,
          label: `${service.durationMins} minutes`,
          labelAr: `${service.durationMins} دقيقة`,
          durationMins: service.durationMins,
          price: service.price,
          currency: 'SAR',
          isDefault: true,
          isActive: true,
        },
        create: {
          id: service.durationId,
          serviceId: service.id,
          deliveryType: DeliveryType.ONLINE,
          label: `${service.durationMins} minutes`,
          labelAr: `${service.durationMins} دقيقة`,
          durationMins: service.durationMins,
          price: service.price,
          currency: 'SAR',
          isDefault: true,
          isActive: true,
        },
      });
    }

    for (const employee of employees) {
      await prisma.employee.upsert({
        where: { id: employee.id },
        update: {
          name: employee.name,
          nameAr: employee.nameAr,
          nameEn: employee.nameEn,
          title: employee.title,
          specialty: employee.specialty,
          specialtyAr: employee.specialtyAr,
          gender: employee.gender,
          experience: employee.experience,
          slug: employee.slug,
          isPublic: true,
          isActive: true,
          publicBioAr: employee.bioAr,
        },
        create: {
          id: employee.id,
          name: employee.name,
          nameAr: employee.nameAr,
          nameEn: employee.nameEn,
          title: employee.title,
          specialty: employee.specialty,
          specialtyAr: employee.specialtyAr,
          gender: employee.gender,
          experience: employee.experience,
          slug: employee.slug,
          isPublic: true,
          isActive: true,
          publicBioAr: employee.bioAr,
          onboardingStatus: 'COMPLETED',
        },
      });
      await prisma.employeeBranch.upsert({
        where: { employeeId_branchId: { employeeId: employee.id, branchId: IDS.branch } },
        update: {},
        create: { employeeId: employee.id, branchId: IDS.branch },
      });
      for (const serviceId of employee.serviceIds) {
        await prisma.employeeService.upsert({
          where: { employeeId_serviceId: { employeeId: employee.id, serviceId } },
          update: { isActive: true },
          create: { employeeId: employee.id, serviceId, isActive: true },
        });
      }
      for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek += 1) {
        const availabilityId = `71aa0000-0000-4000-8${dayOfWeek}00-${employee.id.slice(-12)}`;
        await prisma.employeeAvailability.upsert({
          where: { id: availabilityId },
          update: { startTime: '09:00', endTime: '21:00', isActive: true },
          create: {
            id: availabilityId,
            employeeId: employee.id,
            dayOfWeek,
            startTime: '09:00',
            endTime: '21:00',
            isActive: true,
          },
        });
      }
    }

    for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek += 1) {
      await prisma.businessHour.upsert({
        where: { branchId_dayOfWeek: { branchId: IDS.branch, dayOfWeek } },
        update: { startTime: '09:00', endTime: '21:00', isOpen: true },
        create: {
          branchId: IDS.branch,
          dayOfWeek,
          startTime: '09:00',
          endTime: '21:00',
          isOpen: true,
        },
      });
    }

    const programs = [
      {
        id: IDS.programs.communication,
        nameAr: 'برنامج مهارات التواصل الأسري',
        nameEn: 'Family Communication Skills',
        descriptionAr: 'برنامج جماعي عملي لتقوية الحوار وفهم الاحتياجات وحل الخلافات اليومية.',
        price: 80000,
        supervisorId: IDS.employees.sara,
      },
      {
        id: IDS.programs.parenting,
        nameAr: 'برنامج الوالدية الواعية',
        nameEn: 'Mindful Parenting Program',
        descriptionAr: 'برنامج يساعد الوالدين على بناء حدود واضحة وتواصل هادئ مع الأبناء.',
        price: 65000,
        supervisorId: IDS.employees.noura,
      },
    ] as const;
    for (const program of programs) {
      await prisma.program.upsert({
        where: { id: program.id },
        update: {
          departmentId: IDS.department,
          branchId: IDS.branch,
          nameAr: program.nameAr,
          nameEn: program.nameEn,
          descriptionAr: program.descriptionAr,
          publicDescriptionAr: program.descriptionAr,
          daysCount: 4,
          hoursPerDay: 2,
          minParticipants: 2,
          maxParticipants: 12,
          price: program.price,
          status: ProgramStatus.OPEN,
          isPublic: true,
        },
        create: {
          id: program.id,
          departmentId: IDS.department,
          branchId: IDS.branch,
          nameAr: program.nameAr,
          nameEn: program.nameEn,
          descriptionAr: program.descriptionAr,
          publicDescriptionAr: program.descriptionAr,
          daysCount: 4,
          hoursPerDay: 2,
          minParticipants: 2,
          maxParticipants: 12,
          price: program.price,
          currency: 'SAR',
          status: ProgramStatus.OPEN,
          isPublic: true,
        },
      });
      await prisma.programSupervisor.upsert({
        where: { programId_employeeId: { programId: program.id, employeeId: program.supervisorId } },
        update: {},
        create: { programId: program.id, employeeId: program.supervisorId },
      });
    }

    const packages = [
      {
        id: IDS.packages.family,
        itemId: IDS.packageItems.family,
        serviceConstraintId: IDS.packageConstraints.familyService,
        deliveryConstraintId: IDS.packageConstraints.familyDelivery,
        targetId: IDS.packageTargets.familyService,
        serviceId: IDS.services.family,
        nameAr: 'باقة التوازن الأسري',
        nameEn: 'Family Balance Package',
        descriptionAr: 'أربع جلسات إرشاد أسري مع جلسة إضافية، للحضور أو الأونلاين.',
        unitPrice: 30000,
        sortOrder: 0,
      },
      {
        id: IDS.packages.couples,
        itemId: IDS.packageItems.couples,
        serviceConstraintId: IDS.packageConstraints.couplesService,
        deliveryConstraintId: IDS.packageConstraints.couplesDelivery,
        targetId: IDS.packageTargets.couplesService,
        serviceId: IDS.services.couples,
        nameAr: 'باقة بداية أفضل للزوجين',
        nameEn: 'A Better Start for Couples',
        descriptionAr: 'ثلاث استشارات زوجية بسعر مخفّض، متاحة للحضور أو الأونلاين.',
        unitPrice: 35000,
        sortOrder: 1,
      },
    ] as const;
    for (const pkg of packages) {
      await prisma.sessionPackage.upsert({
        where: { id: pkg.id },
        update: {
          nameAr: pkg.nameAr,
          nameEn: pkg.nameEn,
          descriptionAr: pkg.descriptionAr,
          discountType: DiscountType.PERCENTAGE,
          discountValue: 0,
          isActive: true,
          isPublic: true,
          archivedAt: null,
          sortOrder: pkg.sortOrder,
        },
        create: {
          id: pkg.id,
          nameAr: pkg.nameAr,
          nameEn: pkg.nameEn,
          descriptionAr: pkg.descriptionAr,
          iconName: 'PackageCheck',
          discountType: DiscountType.PERCENTAGE,
          discountValue: 0,
          isActive: true,
          isPublic: true,
          sortOrder: pkg.sortOrder,
        },
      });
      await prisma.sessionPackageItem.upsert({
        where: { id: pkg.itemId },
        update: {
          packageId: pkg.id,
          unitPrice: pkg.unitPrice,
          label: pkg.nameAr,
          paidQuantity: pkg.id === IDS.packages.family ? 4 : 3,
          freeQuantity: pkg.id === IDS.packages.family ? 1 : 0,
          discountType: DiscountType.PERCENTAGE,
          discountValue: 10,
          sortOrder: 0,
        },
        create: {
          id: pkg.itemId,
          packageId: pkg.id,
          unitPrice: pkg.unitPrice,
          label: pkg.nameAr,
          paidQuantity: pkg.id === IDS.packages.family ? 4 : 3,
          freeQuantity: pkg.id === IDS.packages.family ? 1 : 0,
          discountType: DiscountType.PERCENTAGE,
          discountValue: 10,
          sortOrder: 0,
        },
      });
      await prisma.sessionPackageItemConstraint.upsert({
        where: { id: pkg.serviceConstraintId },
        update: {
          itemId: pkg.itemId,
          dimension: PackageConstraintDimension.SERVICE,
          mode: PackageConstraintMode.INCLUDE,
        },
        create: {
          id: pkg.serviceConstraintId,
          itemId: pkg.itemId,
          dimension: PackageConstraintDimension.SERVICE,
          mode: PackageConstraintMode.INCLUDE,
        },
      });
      await prisma.sessionPackageItemConstraintTarget.upsert({
        where: { id: pkg.targetId },
        update: { constraintId: pkg.serviceConstraintId, targetId: pkg.serviceId },
        create: { id: pkg.targetId, constraintId: pkg.serviceConstraintId, targetId: pkg.serviceId },
      });
      await prisma.sessionPackageItemConstraint.upsert({
        where: { id: pkg.deliveryConstraintId },
        update: {
          itemId: pkg.itemId,
          dimension: PackageConstraintDimension.DELIVERY_TYPE,
          mode: PackageConstraintMode.ANY,
        },
        create: {
          id: pkg.deliveryConstraintId,
          itemId: pkg.itemId,
          dimension: PackageConstraintDimension.DELIVERY_TYPE,
          mode: PackageConstraintMode.ANY,
        },
      });
    }

    const counts = {
      services: await prisma.service.count({ where: { id: { in: services.map((s) => s.id) } } }),
      employees: await prisma.employee.count({ where: { id: { in: employees.map((e) => e.id) } } }),
      programs: await prisma.program.count({ where: { id: { in: programs.map((p) => p.id) } } }),
      packages: await prisma.sessionPackage.count({ where: { id: { in: packages.map((p) => p.id) } } }),
    };
    console.log(JSON.stringify({ status: 'ok', counts }, null, 2));
  } finally {
    await prisma.$disconnect();
  }

  if (process.env.REDIS_HOST && process.env.REDIS_PORT) {
    const redis = new Redis({
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT),
      db: Number(process.env.REDIS_DB ?? 0),
      password: process.env.REDIS_PASSWORD || undefined,
    });
    try {
      await redis.del('ref:public-catalog', 'ref:public-packages');
    } finally {
      await redis.quit();
    }
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
